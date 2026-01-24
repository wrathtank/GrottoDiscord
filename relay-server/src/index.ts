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

// Configuration from environment
const SERVER_ID = process.env.SERVER_ID || 'dev-server';
const API_KEY = process.env.API_KEY || '';
const MAX_LOBBIES = parseInt(process.env.MAX_LOBBIES || '10');
const MAX_PLAYERS_PER_LOBBY = parseInt(process.env.MAX_PLAYERS_PER_LOBBY || '16');
const ALLOW_PUBLIC_LOBBIES = process.env.ALLOW_PUBLIC_LOBBIES !== 'false';
const REQUIRE_LOBBY_PASSWORDS = process.env.REQUIRE_LOBBY_PASSWORDS === 'true';
const SERVER_PASSWORD = process.env.SERVER_PASSWORD || '';

// Types
interface Player {
  id: string;
  name: string;
  socket: WebSocket;
  lobbyId: string | null;
  token: string;
  isHost: boolean;
}

interface Lobby {
  id: string;
  code: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  isPublic: boolean;
  hasPassword: boolean;
  password: string | null;
  players: Map<string, Player>;
  createdAt: Date;
}

// State
const players = new Map<string, Player>();
const lobbies = new Map<string, Lobby>();
const tokenToPlayer = new Map<string, string>();

// Helpers
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Ensure unique
  for (const lobby of lobbies.values()) {
    if (lobby.code === code) return generateCode();
  }
  return code;
}

function generateToken(): string {
  return uuidv4() + '-' + Date.now().toString(36);
}

function lobbyToJson(lobby: Lobby, includePassword = false) {
  return {
    id: lobby.id,
    code: lobby.code,
    name: lobby.name,
    hostId: lobby.hostId,
    playerCount: lobby.players.size,
    maxPlayers: lobby.maxPlayers,
    isPublic: lobby.isPublic,
    hasPassword: lobby.hasPassword,
    players: Array.from(lobby.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost
    }))
  };
}

function broadcast(lobby: Lobby, message: any, excludeId?: string) {
  const json = JSON.stringify(message);
  for (const player of lobby.players.values()) {
    if (player.id !== excludeId && player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(json);
    }
  }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    serverId: SERVER_ID,
    lobbies: lobbies.size,
    players: players.size
  });
});

// Get server info
app.get('/api/info', (req, res) => {
  res.json({
    success: true,
    server: {
      id: SERVER_ID,
      maxLobbies: MAX_LOBBIES,
      maxPlayersPerLobby: MAX_PLAYERS_PER_LOBBY,
      allowPublicLobbies: ALLOW_PUBLIC_LOBBIES,
      requireLobbyPasswords: REQUIRE_LOBBY_PASSWORDS,
      hasPassword: !!SERVER_PASSWORD
    }
  });
});

// List public lobbies
app.get('/api/lobbies', (req, res) => {
  const publicLobbies = Array.from(lobbies.values())
    .filter(l => l.isPublic)
    .map(l => lobbyToJson(l));

  res.json({ success: true, lobbies: publicLobbies });
});

// Create lobby
app.post('/api/lobbies', (req, res) => {
  const { name, maxPlayers, isPublic, password, playerName } = req.body;

  // Validate
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: 'Invalid lobby name' });
  }

  if (lobbies.size >= MAX_LOBBIES) {
    return res.status(400).json({ success: false, error: 'Server full - max lobbies reached' });
  }

  if (REQUIRE_LOBBY_PASSWORDS && !password) {
    return res.status(400).json({ success: false, error: 'Lobby password required' });
  }

  if (!ALLOW_PUBLIC_LOBBIES && isPublic) {
    return res.status(400).json({ success: false, error: 'Public lobbies not allowed' });
  }

  const lobbyId = uuidv4();
  const playerId = uuidv4();
  const token = generateToken();

  const lobby: Lobby = {
    id: lobbyId,
    code: generateCode(),
    name: name.slice(0, 32),
    hostId: playerId,
    maxPlayers: Math.min(Math.max(maxPlayers || 8, 2), MAX_PLAYERS_PER_LOBBY),
    isPublic: isPublic !== false,
    hasPassword: !!password,
    password: password || null,
    players: new Map(),
    createdAt: new Date()
  };

  lobbies.set(lobbyId, lobby);
  tokenToPlayer.set(token, playerId);

  // Player will be added when they connect via WebSocket
  res.json({
    success: true,
    lobby: lobbyToJson(lobby),
    playerId,
    token
  });
});

// Join lobby by code
app.post('/api/lobbies/join', (req, res) => {
  const { code, password, playerName } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, error: 'Lobby code required' });
  }

  const lobby = Array.from(lobbies.values()).find(l => l.code === code.toUpperCase());

  if (!lobby) {
    return res.status(404).json({ success: false, error: 'Lobby not found' });
  }

  if (lobby.players.size >= lobby.maxPlayers) {
    return res.status(400).json({ success: false, error: 'Lobby is full' });
  }

  if (lobby.hasPassword && lobby.password !== password) {
    return res.status(403).json({ success: false, error: 'Invalid password' });
  }

  const playerId = uuidv4();
  const token = generateToken();
  tokenToPlayer.set(token, playerId);

  res.json({
    success: true,
    lobby: lobbyToJson(lobby),
    playerId,
    token
  });
});

// Leave lobby
app.post('/api/lobbies/:lobbyId/leave', (req, res) => {
  const { lobbyId } = req.params;
  const { playerId } = req.body;

  const lobby = lobbies.get(lobbyId);
  if (!lobby) {
    return res.status(404).json({ success: false, error: 'Lobby not found' });
  }

  const player = lobby.players.get(playerId);
  if (player) {
    removePlayerFromLobby(player, lobby);
  }

  res.json({ success: true });
});

// Kick player (host only)
app.post('/api/lobbies/:lobbyId/kick/:targetId', (req, res) => {
  const { lobbyId, targetId } = req.params;
  const authToken = req.headers['authorization']?.replace('Bearer ', '');

  const lobby = lobbies.get(lobbyId);
  if (!lobby) {
    return res.status(404).json({ success: false, error: 'Lobby not found' });
  }

  // Verify requester is host
  const requesterId = tokenToPlayer.get(authToken || '');
  if (requesterId !== lobby.hostId) {
    return res.status(403).json({ success: false, error: 'Only host can kick' });
  }

  const target = lobby.players.get(targetId);
  if (target) {
    target.socket.send(JSON.stringify({ type: 'kicked' }));
    removePlayerFromLobby(target, lobby);
  }

  res.json({ success: true });
});

// Close lobby (host only)
app.post('/api/lobbies/:lobbyId/close', (req, res) => {
  const { lobbyId } = req.params;
  const authToken = req.headers['authorization']?.replace('Bearer ', '');

  const lobby = lobbies.get(lobbyId);
  if (!lobby) {
    return res.status(404).json({ success: false, error: 'Lobby not found' });
  }

  const requesterId = tokenToPlayer.get(authToken || '');
  if (requesterId !== lobby.hostId) {
    return res.status(403).json({ success: false, error: 'Only host can close' });
  }

  // Notify all players
  broadcast(lobby, { type: 'closed' });

  // Disconnect all
  for (const player of lobby.players.values()) {
    player.socket.close();
    players.delete(player.id);
  }

  lobbies.delete(lobbyId);
  res.json({ success: true });
});

// WebSocket handling
wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const lobbyId = url.searchParams.get('lobby');
  const token = url.searchParams.get('token');
  const playerName = url.searchParams.get('name') || 'Player';

  if (!lobbyId || !token) {
    ws.close(4000, 'Missing lobby or token');
    return;
  }

  const playerId = tokenToPlayer.get(token);
  if (!playerId) {
    ws.close(4001, 'Invalid token');
    return;
  }

  const lobby = lobbies.get(lobbyId);
  if (!lobby) {
    ws.close(4002, 'Lobby not found');
    return;
  }

  if (lobby.players.size >= lobby.maxPlayers && !lobby.players.has(playerId)) {
    ws.close(4003, 'Lobby full');
    return;
  }

  // Create/update player
  const isHost = playerId === lobby.hostId;
  const player: Player = {
    id: playerId,
    name: playerName.slice(0, 24),
    socket: ws,
    lobbyId: lobbyId,
    token,
    isHost
  };

  players.set(playerId, player);
  lobby.players.set(playerId, player);

  // Notify others
  broadcast(lobby, {
    type: 'player_joined',
    data: JSON.stringify({ id: playerId, name: player.name, isHost })
  }, playerId);

  // Send current lobby state
  ws.send(JSON.stringify({
    type: 'connected',
    lobby: lobbyToJson(lobby),
    playerId,
    isHost
  }));

  // Handle messages
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(player, lobby, msg);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    removePlayerFromLobby(player, lobby);
    players.delete(playerId);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

function handleMessage(player: Player, lobby: Lobby, msg: any) {
  switch (msg.type) {
    case 'broadcast':
      // Send to all players in lobby
      broadcast(lobby, {
        type: 'message',
        from: player.id,
        channel: msg.channel,
        data: msg.data
      }, player.id);
      break;

    case 'send':
      // Send to specific player
      const target = lobby.players.get(msg.target);
      if (target && target.socket.readyState === WebSocket.OPEN) {
        target.socket.send(JSON.stringify({
          type: 'message',
          from: player.id,
          channel: msg.channel,
          data: msg.data
        }));
      }
      break;

    case 'ping':
      player.socket.send(JSON.stringify({ type: 'pong' }));
      break;
  }
}

function removePlayerFromLobby(player: Player, lobby: Lobby) {
  lobby.players.delete(player.id);

  // Notify remaining players
  broadcast(lobby, {
    type: 'player_left',
    data: JSON.stringify({ id: player.id, name: player.name })
  });

  // If host left, either migrate or close
  if (player.id === lobby.hostId) {
    if (lobby.players.size > 0) {
      // Migrate host to first remaining player
      const newHost = lobby.players.values().next().value;
      if (newHost) {
        lobby.hostId = newHost.id;
        newHost.isHost = true;
        broadcast(lobby, {
          type: 'host_migrated',
          data: JSON.stringify({ newHostId: newHost.id })
        });
      }
    } else {
      // No players left, close lobby
      lobbies.delete(lobby.id);
    }
  }

  // Clean up token
  tokenToPlayer.delete(player.token);
}

// Periodic cleanup of empty lobbies
setInterval(() => {
  const now = Date.now();
  for (const [id, lobby] of lobbies) {
    // Remove empty lobbies older than 5 minutes
    if (lobby.players.size === 0 && now - lobby.createdAt.getTime() > 5 * 60 * 1000) {
      lobbies.delete(id);
    }
  }
}, 60000);

// Start server
const PORT = process.env.PORT || 7777;
server.listen(PORT, () => {
  console.log(`Grotto Relay Server running on port ${PORT}`);
  console.log(`Server ID: ${SERVER_ID}`);
  console.log(`Max Lobbies: ${MAX_LOBBIES}`);
  console.log(`Max Players/Lobby: ${MAX_PLAYERS_PER_LOBBY}`);
});
