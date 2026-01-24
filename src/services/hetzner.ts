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

// Generate API key for the server
function generateApiKey(): string {
  return 'grotto_' + crypto.randomBytes(24).toString('hex');
}

// Cloud-init script to set up the relay server
const getCloudInitScript = (
  serverId: string,
  serverName: string,
  port: number,
  apiKey: string,
  settings: {
    maxLobbies?: number;
    maxPlayersPerLobby?: number;
    allowPublicLobbies?: boolean;
    requireLobbyPasswords?: boolean;
    serverPassword?: string;
  } = {}
) => `#cloud-config
package_update: true
package_upgrade: true

packages:
  - docker.io
  - docker-compose
  - ufw
  - fail2ban
  - curl

write_files:
  - path: /opt/grotto/server-id
    content: "${serverId}"
  - path: /opt/grotto/.env
    permissions: '0600'
    content: |
      SERVER_ID=${serverId}
      API_KEY=${apiKey}
      PORT=${port}
      MAX_LOBBIES=${settings.maxLobbies || 10}
      MAX_PLAYERS_PER_LOBBY=${settings.maxPlayersPerLobby || 16}
      ALLOW_PUBLIC_LOBBIES=${settings.allowPublicLobbies !== false}
      REQUIRE_LOBBY_PASSWORDS=${settings.requireLobbyPasswords || false}
      SERVER_PASSWORD=${settings.serverPassword || ''}
  - path: /opt/grotto/docker-compose.yml
    content: |
      version: '3.8'
      services:
        relay:
          image: node:20-alpine
          container_name: grotto-relay
          restart: unless-stopped
          working_dir: /app
          env_file: .env
          ports:
            - "${port}:${port}"
          volumes:
            - ./relay-server:/app
          command: sh -c "npm install && npm run build && npm start"
  - path: /opt/grotto/relay-server/package.json
    content: |
      {
        "name": "grotto-relay-server",
        "version": "1.0.0",
        "main": "dist/index.js",
        "scripts": {
          "build": "npx tsc",
          "start": "node dist/index.js"
        },
        "dependencies": {
          "ws": "^8.14.2",
          "express": "^4.18.2",
          "uuid": "^9.0.0",
          "cors": "^2.8.5"
        },
        "devDependencies": {
          "@types/ws": "^8.5.8",
          "@types/express": "^4.17.20",
          "@types/uuid": "^9.0.6",
          "@types/cors": "^2.8.15",
          "typescript": "^5.2.2"
        }
      }
  - path: /opt/grotto/relay-server/tsconfig.json
    content: |
      {
        "compilerOptions": {
          "target": "ES2020",
          "module": "commonjs",
          "outDir": "./dist",
          "rootDir": "./src",
          "strict": true,
          "esModuleInterop": true,
          "skipLibCheck": true
        },
        "include": ["src/**/*"]
      }
  - path: /opt/grotto/relay-server/src/index.ts
    content: |
      import express from 'express';
      import cors from 'cors';
      import { WebSocketServer, WebSocket } from 'ws';
      import { createServer } from 'http';
      import { v4 as uuidv4 } from 'uuid';

      const app = express();
      app.use(cors());
      app.use(express.json());

      const server = createServer(app);
      const wss = new WebSocketServer({ server });

      const SERVER_ID = process.env.SERVER_ID || 'dev';
      const API_KEY = process.env.API_KEY || '';
      const MAX_LOBBIES = parseInt(process.env.MAX_LOBBIES || '10');
      const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS_PER_LOBBY || '16');
      const ALLOW_PUBLIC = process.env.ALLOW_PUBLIC_LOBBIES !== 'false';
      const REQUIRE_PWD = process.env.REQUIRE_LOBBY_PASSWORDS === 'true';

      interface Player { id: string; name: string; socket: WebSocket; lobbyId: string|null; token: string; isHost: boolean; }
      interface Lobby { id: string; code: string; name: string; hostId: string; maxPlayers: number; isPublic: boolean; hasPassword: boolean; password: string|null; players: Map<string, Player>; createdAt: Date; }

      const players = new Map<string, Player>();
      const lobbies = new Map<string, Lobby>();
      const tokenToPlayer = new Map<string, string>();

      function genCode(): string { const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r=''; for(let i=0;i<6;i++)r+=c[Math.floor(Math.random()*c.length)]; for(const l of lobbies.values())if(l.code===r)return genCode(); return r; }
      function genToken(): string { return uuidv4()+'-'+Date.now().toString(36); }
      function lobbyJson(l: Lobby) { return { id:l.id, code:l.code, name:l.name, hostId:l.hostId, playerCount:l.players.size, maxPlayers:l.maxPlayers, isPublic:l.isPublic, hasPassword:l.hasPassword, players:Array.from(l.players.values()).map(p=>({id:p.id,name:p.name,isHost:p.isHost})) }; }
      function broadcast(l: Lobby, msg: any, exclude?: string) { const j=JSON.stringify(msg); for(const p of l.players.values()) if(p.id!==exclude && p.socket.readyState===WebSocket.OPEN) p.socket.send(j); }

      app.get('/health', (_,res) => res.json({ status:'ok', serverId:SERVER_ID, lobbies:lobbies.size, players:players.size }));
      app.get('/api/info', (_,res) => res.json({ success:true, server:{ id:SERVER_ID, maxLobbies:MAX_LOBBIES, maxPlayersPerLobby:MAX_PLAYERS, allowPublicLobbies:ALLOW_PUBLIC, requireLobbyPasswords:REQUIRE_PWD } }));
      app.get('/api/lobbies', (_,res) => res.json({ success:true, lobbies:Array.from(lobbies.values()).filter(l=>l.isPublic).map(lobbyJson) }));

      app.post('/api/lobbies', (req,res) => {
        const { name, maxPlayers, isPublic, password } = req.body;
        if(!name) return res.status(400).json({ success:false, error:'Name required' });
        if(lobbies.size >= MAX_LOBBIES) return res.status(400).json({ success:false, error:'Server full' });
        if(REQUIRE_PWD && !password) return res.status(400).json({ success:false, error:'Password required' });
        if(!ALLOW_PUBLIC && isPublic) return res.status(400).json({ success:false, error:'Public lobbies disabled' });
        const lobbyId = uuidv4(), playerId = uuidv4(), token = genToken();
        const lobby: Lobby = { id:lobbyId, code:genCode(), name:name.slice(0,32), hostId:playerId, maxPlayers:Math.min(Math.max(maxPlayers||8,2),MAX_PLAYERS), isPublic:isPublic!==false, hasPassword:!!password, password:password||null, players:new Map(), createdAt:new Date() };
        lobbies.set(lobbyId, lobby);
        tokenToPlayer.set(token, playerId);
        res.json({ success:true, lobby:lobbyJson(lobby), playerId, token });
      });

      app.post('/api/lobbies/join', (req,res) => {
        const { code, password } = req.body;
        if(!code) return res.status(400).json({ success:false, error:'Code required' });
        const lobby = Array.from(lobbies.values()).find(l=>l.code===code.toUpperCase());
        if(!lobby) return res.status(404).json({ success:false, error:'Not found' });
        if(lobby.players.size >= lobby.maxPlayers) return res.status(400).json({ success:false, error:'Full' });
        if(lobby.hasPassword && lobby.password !== password) return res.status(403).json({ success:false, error:'Wrong password' });
        const playerId = uuidv4(), token = genToken();
        tokenToPlayer.set(token, playerId);
        res.json({ success:true, lobby:lobbyJson(lobby), playerId, token });
      });

      app.post('/api/lobbies/:lobbyId/leave', (req,res) => {
        const lobby = lobbies.get(req.params.lobbyId);
        if(!lobby) return res.status(404).json({ success:false, error:'Not found' });
        const player = lobby.players.get(req.body.playerId);
        if(player) removePl(player, lobby);
        res.json({ success:true });
      });

      function removePl(p: Player, l: Lobby) {
        l.players.delete(p.id);
        broadcast(l, { type:'player_left', data:JSON.stringify({id:p.id,name:p.name}) });
        if(p.id === l.hostId) {
          if(l.players.size > 0) { const nh = l.players.values().next().value; if(nh){ l.hostId=nh.id; nh.isHost=true; broadcast(l,{type:'host_migrated',data:JSON.stringify({newHostId:nh.id})}); } }
          else lobbies.delete(l.id);
        }
        tokenToPlayer.delete(p.token);
      }

      wss.on('connection', (ws, req) => {
        const url = new URL(req.url||'', 'http://localhost');
        const lobbyId = url.searchParams.get('lobby'), token = url.searchParams.get('token'), pname = url.searchParams.get('name')||'Player';
        if(!lobbyId||!token) return ws.close(4000);
        const playerId = tokenToPlayer.get(token);
        if(!playerId) return ws.close(4001);
        const lobby = lobbies.get(lobbyId);
        if(!lobby) return ws.close(4002);
        if(lobby.players.size >= lobby.maxPlayers && !lobby.players.has(playerId)) return ws.close(4003);
        const isHost = playerId === lobby.hostId;
        const player: Player = { id:playerId, name:pname.slice(0,24), socket:ws, lobbyId, token, isHost };
        players.set(playerId, player);
        lobby.players.set(playerId, player);
        broadcast(lobby, { type:'player_joined', data:JSON.stringify({id:playerId,name:player.name,isHost}) }, playerId);
        ws.send(JSON.stringify({ type:'connected', lobby:lobbyJson(lobby), playerId, isHost }));
        ws.on('message', (data) => {
          try { const msg = JSON.parse(data.toString());
            if(msg.type==='broadcast') broadcast(lobby, { type:'message', from:player.id, channel:msg.channel, data:msg.data }, player.id);
            else if(msg.type==='send') { const t=lobby.players.get(msg.target); if(t&&t.socket.readyState===WebSocket.OPEN) t.socket.send(JSON.stringify({type:'message',from:player.id,channel:msg.channel,data:msg.data})); }
            else if(msg.type==='ping') ws.send(JSON.stringify({type:'pong'}));
          } catch {}
        });
        ws.on('close', () => { removePl(player, lobby); players.delete(playerId); });
      });

      setInterval(() => { const now=Date.now(); for(const [id,l] of lobbies) if(l.players.size===0 && now-l.createdAt.getTime()>300000) lobbies.delete(id); }, 60000);

      const PORT = process.env.PORT || 7777;
      server.listen(PORT, () => console.log('Grotto Relay running on port ' + PORT));
  - path: /opt/grotto/heartbeat.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      API="${process.env.API_URL || 'https://grotto-discord-bot-7dcd8c6451fc.herokuapp.com'}"
      SERVER_ID="${serverId}"
      while true; do
        HEALTH=$(curl -s http://localhost:${port}/health 2>/dev/null || echo '{}')
        PLAYERS=$(echo $HEALTH | grep -o '"players":[0-9]*' | grep -o '[0-9]*' || echo "0")
        LOBBIES=$(echo $HEALTH | grep -o '"lobbies":[0-9]*' | grep -o '[0-9]*' || echo "0")
        curl -s -X POST "$API/api/servers/$SERVER_ID/heartbeat" \\
          -H "Content-Type: application/json" \\
          -d "{\\"currentPlayers\\": $PLAYERS, \\"lobbies\\": $LOBBIES, \\"status\\": \\"online\\"}" || true
        sleep 60
      done

runcmd:
  - mkdir -p /opt/grotto/relay-server/src
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow ssh
  - ufw allow ${port}/tcp
  - ufw --force enable
  - systemctl enable docker
  - systemctl start docker
  - cd /opt/grotto && docker-compose up -d
  - sleep 30
  - nohup /opt/grotto/heartbeat.sh > /var/log/grotto-heartbeat.log 2>&1 &
`;

export { generateApiKey };

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
  port: number = 7777,
  apiKey: string = '',
  settings: {
    maxLobbies?: number;
    maxPlayersPerLobby?: number;
    allowPublicLobbies?: boolean;
    requireLobbyPasswords?: boolean;
    serverPassword?: string;
  } = {}
): Promise<{ success: boolean; ip?: string; hetznerServerId?: number; error?: string }> {
  if (!HETZNER_API_TOKEN) {
    console.error('[Hetzner] API token not configured');
    return { success: false, error: 'Hetzner API not configured' };
  }

  try {
    const cloudInit = getCloudInitScript(serverId, serverName, port, apiKey || generateApiKey(), settings);
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
