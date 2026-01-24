// Hetzner Cloud Provisioning Service
// Automatically provisions game servers when users purchase

import crypto from 'crypto';

// Hetzner API configuration
const HETZNER_API_URL = 'https://api.hetzner.cloud/v1';
const HETZNER_API_TOKEN = process.env.HETZNER_API_TOKEN || '';

// Server configuration
const SERVER_CONFIG = {
  serverType: 'cx22', // 2 vCPU, 4GB RAM, ~$5.39/month
  image: 'ubuntu-22.04',
  location: 'ash', // Ashburn, VA (US East) - or 'fsn1' for EU
  sshKeyName: process.env.HETZNER_SSH_KEY_NAME || 'grotto-servers',
};

// Cloud-init script to set up the game server environment
const getCloudInitScript = (serverId: string, serverName: string, port: number) => `#cloud-config
package_update: true
package_upgrade: true

packages:
  - docker.io
  - docker-compose
  - ufw
  - fail2ban

write_files:
  - path: /opt/grotto/server-id
    content: "${serverId}"
  - path: /opt/grotto/config.json
    content: |
      {
        "serverId": "${serverId}",
        "serverName": "${serverName}",
        "port": ${port},
        "apiEndpoint": "${process.env.API_URL || 'https://grotto-discord-bot-7dcd8c6451fc.herokuapp.com'}"
      }
  - path: /opt/grotto/docker-compose.yml
    content: |
      version: '3.8'
      services:
        gameserver:
          image: ubuntu:22.04
          container_name: grotto-gameserver
          restart: unless-stopped
          ports:
            - "${port}:${port}/udp"
            - "${port}:${port}/tcp"
          volumes:
            - /opt/grotto/game:/game
            - /opt/grotto/data:/data
          working_dir: /game
          command: ["sleep", "infinity"]

        # Optional: Add database if needed
        # postgres:
        #   image: postgres:15
        #   restart: unless-stopped
        #   environment:
        #     POSTGRES_DB: gamedb
        #     POSTGRES_USER: game
        #     POSTGRES_PASSWORD: \${DB_PASSWORD}
        #   volumes:
        #     - /opt/grotto/postgres:/var/lib/postgresql/data

  - path: /opt/grotto/heartbeat.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      API="${process.env.API_URL || 'https://grotto-discord-bot-7dcd8c6451fc.herokuapp.com'}"
      SERVER_ID="${serverId}"
      while true; do
        PLAYERS=$(docker exec grotto-gameserver cat /tmp/player_count 2>/dev/null || echo "0")
        curl -s -X POST "$API/api/servers/$SERVER_ID/heartbeat" \\
          -H "Content-Type: application/json" \\
          -d "{\\"currentPlayers\\": $PLAYERS}" || true
        sleep 60
      done

runcmd:
  - mkdir -p /opt/grotto/game /opt/grotto/data
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow ssh
  - ufw allow ${port}/tcp
  - ufw allow ${port}/udp
  - ufw --force enable
  - systemctl enable docker
  - systemctl start docker
  - cd /opt/grotto && docker-compose up -d
  - nohup /opt/grotto/heartbeat.sh &
`;

interface HetznerServer {
  id: number;
  name: string;
  public_net: {
    ipv4: { ip: string };
    ipv6: { ip: string };
  };
  status: string;
  server_type: { name: string };
  datacenter: { name: string };
}

interface HetznerResponse {
  server?: HetznerServer;
  action?: { id: number; status: string };
  error?: { code: string; message: string };
}

// Create a new Hetzner server
export async function createHetznerServer(
  serverId: string,
  serverName: string,
  port: number = 7777
): Promise<{ success: boolean; ip?: string; hetznerServerId?: number; error?: string }> {
  if (!HETZNER_API_TOKEN) {
    console.error('[Hetzner] API token not configured');
    return { success: false, error: 'Hetzner API not configured' };
  }

  try {
    const cloudInit = getCloudInitScript(serverId, serverName, port);
    const cloudInitBase64 = Buffer.from(cloudInit).toString('base64');

    const response = await fetch(`${HETZNER_API_URL}/servers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HETZNER_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `grotto-${serverId}`,
        server_type: SERVER_CONFIG.serverType,
        image: SERVER_CONFIG.image,
        location: SERVER_CONFIG.location,
        start_after_create: true,
        user_data: cloudInitBase64,
        labels: {
          service: 'grotto-servers',
          server_id: serverId,
        },
      }),
    });

    const data: HetznerResponse = await response.json();

    if (data.error) {
      console.error('[Hetzner] API error:', data.error);
      return { success: false, error: data.error.message };
    }

    if (!data.server) {
      return { success: false, error: 'No server in response' };
    }

    console.log(`[Hetzner] Created server ${data.server.id} with IP ${data.server.public_net.ipv4.ip}`);

    return {
      success: true,
      ip: data.server.public_net.ipv4.ip,
      hetznerServerId: data.server.id,
    };
  } catch (error) {
    console.error('[Hetzner] Failed to create server:', error);
    return { success: false, error: 'Failed to provision server' };
  }
}

// Delete a Hetzner server
export async function deleteHetznerServer(hetznerServerId: number): Promise<boolean> {
  if (!HETZNER_API_TOKEN) {
    console.error('[Hetzner] API token not configured');
    return false;
  }

  try {
    const response = await fetch(`${HETZNER_API_URL}/servers/${hetznerServerId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${HETZNER_API_TOKEN}`,
      },
    });

    if (response.ok) {
      console.log(`[Hetzner] Deleted server ${hetznerServerId}`);
      return true;
    }

    const data = await response.json();
    console.error('[Hetzner] Failed to delete:', data.error);
    return false;
  } catch (error) {
    console.error('[Hetzner] Delete error:', error);
    return false;
  }
}

// Get server status
export async function getHetznerServerStatus(hetznerServerId: number): Promise<string | null> {
  if (!HETZNER_API_TOKEN) return null;

  try {
    const response = await fetch(`${HETZNER_API_URL}/servers/${hetznerServerId}`, {
      headers: {
        'Authorization': `Bearer ${HETZNER_API_TOKEN}`,
      },
    });

    const data: HetznerResponse = await response.json();
    return data.server?.status || null;
  } catch (error) {
    console.error('[Hetzner] Status check error:', error);
    return null;
  }
}

// Power actions
export async function powerAction(
  hetznerServerId: number,
  action: 'poweron' | 'poweroff' | 'reboot'
): Promise<boolean> {
  if (!HETZNER_API_TOKEN) return false;

  try {
    const response = await fetch(`${HETZNER_API_URL}/servers/${hetznerServerId}/actions/${action}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HETZNER_API_TOKEN}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error(`[Hetzner] Power action ${action} failed:`, error);
    return false;
  }
}

// List all Grotto servers (for admin/monitoring)
export async function listGrottoServers(): Promise<HetznerServer[]> {
  if (!HETZNER_API_TOKEN) return [];

  try {
    const response = await fetch(
      `${HETZNER_API_URL}/servers?label_selector=service=grotto-servers`,
      {
        headers: {
          'Authorization': `Bearer ${HETZNER_API_TOKEN}`,
        },
      }
    );

    const data = await response.json();
    return data.servers || [];
  } catch (error) {
    console.error('[Hetzner] List servers error:', error);
    return [];
  }
}

// Check if Hetzner is configured
export function isHetznerConfigured(): boolean {
  return !!HETZNER_API_TOKEN;
}
