import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { BlockchainService } from '../services/blockchain';
import { createHetznerServer, deleteHetznerServer, isHetznerConfigured } from '../services/hetzner';
import { verifyHeresyTransfer } from '../services/payment';
import { BotConfig, GameServer, ServerRental, ServerTier, ServerStatus, CreateServerRequest } from '../types';
import {
  getVerificationSession,
  deleteVerificationSession,
  linkWallet,
  getWalletByAddress,
  createGameServer,
  getGameServer,
  getGameServersByOwner,
  getAllGameServers,
  updateGameServerStatus,
  createServerRental,
  getRentalByTxHash,
  updateRentalStatus,
} from '../database/unified';
import { Client, EmbedBuilder } from 'discord.js';

let discordClient: Client;
let blockchain: BlockchainService;
let config: BotConfig;

export function initApiServer(client: Client, bc: BlockchainService, cfg: BotConfig): express.Application {
  discordClient = client;
  blockchain = bc;
  config = cfg;

  const app = express();

  // Enable CORS for verification domain only
  const allowedOrigins = [
    process.env.VERIFY_WEB_URL || 'https://grotto-verify.vercel.app',
    'https://ggrotto.xyz',
    'https://www.ggrotto.xyz',
    'https://enterthegrotto.xyz',
    'https://www.enterthegrotto.xyz',
    'http://localhost:3000', // Local development
    'http://localhost:5173', // Vite dev server
  ].filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
        callback(null, true);
      } else {
        console.warn(`[API] Blocked CORS request from: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Handle preflight requests
  app.options('*', cors());

  app.use(express.json());

  // Root endpoint - test if API is reachable
  app.get('/', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'Grotto Discord Verification API',
      timestamp: Date.now()
    });
  });

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Test endpoint for verification
  app.get('/api/verify', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      message: 'Verification API is running. Use POST to verify.',
      timestamp: Date.now()
    });
  });

  // Verification endpoint
  app.post('/api/verify', async (req: Request, res: Response) => {
    try {
      const { sessionId, walletAddress, signature, nonce, timestamp } = req.body;

      // Validate required fields
      if (!sessionId || !walletAddress || !signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sessionId, walletAddress, signature',
        });
      }

      // Validate wallet address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid wallet address format',
        });
      }

      // Get the session
      const session = await getVerificationSession(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found or expired. Please start verification again in Discord.',
        });
      }

      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        await deleteVerificationSession(sessionId);
        return res.status(400).json({
          success: false,
          error: 'Session expired. Please start verification again in Discord.',
        });
      }

      // Check if wallet is already linked to another user
      const existingLink = await getWalletByAddress(walletAddress);
      if (existingLink && existingLink.discordId !== session.discordId) {
        return res.status(400).json({
          success: false,
          error: 'This wallet is already linked to another Discord account.',
        });
      }

      // Verify the signature
      const message = blockchain.generateSignatureMessage(session.nonce, timestamp || session.createdAt);

      if (!blockchain.verifySignature(message, signature, walletAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Signature verification failed. Make sure you signed the correct message.',
        });
      }

      // Link the wallet
      await linkWallet(session.discordId, walletAddress, signature, session.nonce);
      await deleteVerificationSession(sessionId);

      // Verify roles and assign them (with retry for cold start RPC issues)
      console.log(`[API] Checking ${config.roles.length} role(s) for wallet ${walletAddress.slice(0, 8)}...`);
      let results = await blockchain.verifyAllRoles(config.roles, walletAddress);
      console.log(`[API] Initial check results:`, results.map(r => ({ role: r.roleName, qualified: r.qualified, details: r.details })));
      let qualifiedRoles = results.filter((r) => r.qualified);

      // If no roles qualified on first try, wait a moment and retry once
      // This handles RPC cold start issues
      if (qualifiedRoles.length === 0 && config.roles.length > 0) {
        console.log(`[API] No roles qualified on first check, retrying in 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        results = await blockchain.verifyAllRoles(config.roles, walletAddress);
        console.log(`[API] Retry results:`, results.map(r => ({ role: r.roleName, qualified: r.qualified, details: r.details })));
        qualifiedRoles = results.filter((r) => r.qualified);
        console.log(`[API] Retry: ${qualifiedRoles.length} role(s) qualified`);
      }

      // Get the guild and member
      const guildId = process.env.DISCORD_GUILD_ID;
      if (!guildId) {
        return res.json({
          success: true,
          message: 'Wallet linked successfully!',
          rolesAssigned: [],
          note: 'Could not assign roles - no guild configured',
        });
      }

      // Use fetch instead of cache to ensure we get the guild
      const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        console.error(`[API] Could not find guild ${guildId}`);
        return res.json({
          success: true,
          message: 'Wallet linked successfully!',
          rolesAssigned: [],
          note: 'Could not find guild',
        });
      }

      // Fetch all guild roles to populate the cache
      await guild.roles.fetch();

      const member = await guild.members.fetch(session.discordId).catch(() => null);
      if (!member) {
        return res.json({
          success: true,
          message: 'Wallet linked successfully!',
          rolesAssigned: [],
          note: 'Could not find member in guild',
        });
      }

      const assignedRoles: string[] = [];

      // Import role assignment function
      const { recordRoleAssignment } = await import('../database/unified');

      for (const result of qualifiedRoles) {
        const roleConfig = config.roles.find((r) => r.id === result.roleId);
        if (!roleConfig) continue;

        try {
          const discordRole = guild.roles.cache.get(roleConfig.discordRoleId);
          if (discordRole && !member.roles.cache.has(discordRole.id)) {
            await member.roles.add(discordRole);
            await recordRoleAssignment(session.discordId, roleConfig.id);
            assignedRoles.push(roleConfig.name);
          }
        } catch (error) {
          console.error(`[API] Failed to assign role ${roleConfig.name}:`, error);
        }
      }

      // Try to DM the user with results
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('✅ Wallet Verified!')
          .setDescription(`Your wallet \`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\` has been verified.`)
          .setColor(0x00ff00)
          .setTimestamp();

        if (assignedRoles.length > 0) {
          dmEmbed.addFields({
            name: 'Roles Assigned',
            value: assignedRoles.map((r) => `• ${r}`).join('\n'),
          });
        } else {
          dmEmbed.addFields({
            name: 'Note',
            value: "Your wallet is linked but you don't currently qualify for any roles. Use `/refresh` to check again later.",
          });
        }

        await member.send({ embeds: [dmEmbed] }).catch(() => {
          // User has DMs disabled, that's fine
        });
      } catch {
        // Ignore DM errors
      }

      console.log(`[API] Verified wallet ${walletAddress.slice(0, 8)}... for user ${session.discordId}, assigned ${assignedRoles.length} role(s)`);

      return res.json({
        success: true,
        message: 'Wallet verified successfully!',
        rolesAssigned: assignedRoles,
        walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      });
    } catch (error) {
      console.error('[API] Verification error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error. Please try again.',
      });
    }
  });

  // ============================================
  // Game Server Rental Endpoints
  // ============================================

  // Server pricing configuration
  // Single tier pricing - dedicated game server
  // At $2500/HERESY, 0.005 HERESY = ~$12.50/month
  const SERVER_PRICING = {
    price: 0.005, // HERESY per month
    maxPlayers: 32,
    cpu: 2,
    ram: 4,
    durationDiscounts: { 1: 0, 3: 0.10, 6: 0.15 } as Record<number, number>,
    treasuryAddress: process.env.TREASURY_ADDRESS || '0x000000000000000000000000000000000000dEaD',
  };

  // Get server pricing info
  app.get('/api/servers/pricing', (req: Request, res: Response) => {
    res.json({
      success: true,
      pricing: SERVER_PRICING,
    });
  });

  // List all public game servers
  app.get('/api/servers', async (req: Request, res: Response) => {
    try {
      const status = req.query.status as ServerStatus | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const servers = await getAllGameServers(status, limit, offset);

      // Filter out sensitive data (password hashes) for public listing
      const publicServers = servers.map(s => ({
        id: s.id,
        name: s.name,
        gameName: s.gameName,
        owner: s.ownerId.slice(0, 6) + '...' + s.ownerId.slice(-4),
        tier: s.tier,
        status: s.status,
        address: s.status === 'online' ? s.address : null,
        port: s.port,
        hasPassword: s.hasPassword,
        currentPlayers: s.currentPlayers,
        maxPlayers: s.maxPlayers,
        createdAt: s.createdAt,
      }));

      return res.json({
        success: true,
        servers: publicServers,
        total: publicServers.length,
      });
    } catch (error) {
      console.error('[API] List servers error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load servers.',
      });
    }
  });

  // Get servers owned by a wallet
  app.get('/api/servers/my', async (req: Request, res: Response) => {
    try {
      const wallet = req.query.wallet as string;

      if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid wallet address.',
        });
      }

      const servers = await getGameServersByOwner(wallet);

      return res.json({
        success: true,
        servers: servers.map(s => ({
          ...s,
          passwordHash: undefined, // Don't expose password hash
        })),
      });
    } catch (error) {
      console.error('[API] My servers error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load your servers.',
      });
    }
  });

  // Get single server details
  app.get('/api/servers/:id', async (req: Request, res: Response) => {
    try {
      const server = await getGameServer(req.params.id);

      if (!server) {
        return res.status(404).json({
          success: false,
          error: 'Server not found.',
        });
      }

      return res.json({
        success: true,
        server: {
          ...server,
          passwordHash: undefined,
          owner: server.ownerId.slice(0, 6) + '...' + server.ownerId.slice(-4),
        },
      });
    } catch (error) {
      console.error('[API] Get server error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load server details.',
      });
    }
  });

  // Create a new server rental
  app.post('/api/servers/create', async (req: Request, res: Response) => {
    try {
      const { name, gameName, password, tier, duration, ownerWallet, txHash } = req.body as CreateServerRequest;

      // Validate required fields
      if (!name || !gameName || !tier || !duration || !ownerWallet || !txHash) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields.',
        });
      }

      // Validate duration
      if (![1, 3, 6].includes(duration)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid rental duration.',
        });
      }

      // Validate wallet address
      if (!/^0x[a-fA-F0-9]{40}$/.test(ownerWallet)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid wallet address.',
        });
      }

      // Check if txHash already used
      const existingRental = await getRentalByTxHash(txHash);
      if (existingRental) {
        return res.status(400).json({
          success: false,
          error: 'Transaction already processed.',
        });
      }

      // Calculate pricing (single tier)
      const discount = SERVER_PRICING.durationDiscounts[duration] || 0;
      const basePrice = SERVER_PRICING.price * duration;
      const totalPrice = basePrice - (basePrice * discount);

      // Verify payment on-chain
      const verification = await verifyHeresyTransfer(
        txHash,
        ownerWallet,
        SERVER_PRICING.treasuryAddress,
        totalPrice
      );

      if (!verification.verified) {
        console.error(`[API] Payment verification failed: ${verification.error}`);
        return res.status(400).json({
          success: false,
          error: verification.error || 'Payment verification failed',
        });
      }

      console.log(`[API] Payment verified: ${verification.amount} HERESY`);

      // Generate IDs
      const serverId = 'srv-' + crypto.randomBytes(8).toString('hex');
      const rentalId = 'rent-' + crypto.randomBytes(8).toString('hex');

      // Hash password if provided
      const passwordHash = password
        ? crypto.createHash('sha256').update(password).digest('hex')
        : undefined;

      // Calculate expiry
      const now = Date.now();
      const expiresAt = now + (duration * 30 * 24 * 60 * 60 * 1000); // months to ms

      // Create server record
      const server: GameServer = {
        id: serverId,
        name: name.slice(0, 32),
        gameName: gameName.slice(0, 64),
        ownerId: ownerWallet.toLowerCase(),
        tier: tier as ServerTier,
        status: 'provisioning',
        address: `${serverId}.grotto.gg`,
        port: 7777,
        hasPassword: !!password,
        passwordHash,
        currentPlayers: 0,
        maxPlayers: SERVER_PRICING.maxPlayers,
        createdAt: now,
        expiresAt,
        txHash,
      };

      // Create rental record
      const rental: ServerRental = {
        id: rentalId,
        serverId,
        ownerId: ownerWallet.toLowerCase(),
        tier: 'standard' as ServerTier, // single tier
        duration,
        pricePerMonth: SERVER_PRICING.price,
        totalPrice,
        discount,
        txHash,
        status: 'pending',
        createdAt: now,
      };

      await createGameServer(server);
      await createServerRental(rental);

      // Provision server with Hetzner
      console.log(`[API] Creating server ${serverId} for wallet ${ownerWallet.slice(0, 8)}...`);

      if (isHetznerConfigured()) {
        // Auto-provision with Hetzner Cloud
        (async () => {
          try {
            const result = await createHetznerServer(serverId, name, server.port);

            if (result.success && result.ip) {
              await updateGameServerStatus(serverId, 'online', result.ip);
              await updateRentalStatus(rentalId, 'confirmed');
              console.log(`[API] Server ${serverId} provisioned at ${result.ip}`);
            } else {
              await updateGameServerStatus(serverId, 'offline');
              await updateRentalStatus(rentalId, 'failed');
              console.error(`[API] Failed to provision ${serverId}: ${result.error}`);
            }
          } catch (err) {
            console.error(`[API] Hetzner provisioning error:`, err);
            await updateGameServerStatus(serverId, 'offline');
            await updateRentalStatus(rentalId, 'failed');
          }
        })();
      } else {
        // Development mode - simulate provisioning
        console.log(`[API] Hetzner not configured, simulating provisioning...`);
        setTimeout(async () => {
          try {
            await updateGameServerStatus(serverId, 'online', `${serverId}.grotto.gg`);
            await updateRentalStatus(rentalId, 'confirmed');
            console.log(`[API] Server ${serverId} provisioned (simulated)`);
          } catch (err) {
            console.error(`[API] Failed to update server status:`, err);
          }
        }, 5000);
      }

      return res.json({
        success: true,
        message: 'Server rental initiated! Your server is being provisioned.',
        server: {
          id: serverId,
          name: server.name,
          gameName: server.gameName,
          tier: server.tier,
          status: server.status,
          address: server.address,
          port: server.port,
          maxPlayers: server.maxPlayers,
          expiresAt: server.expiresAt,
        },
        rental: {
          id: rentalId,
          duration,
          totalPrice,
          discount: discount * 100 + '%',
        },
      });
    } catch (error) {
      console.error('[API] Create server error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create server. Please try again.',
      });
    }
  });

  // Server heartbeat endpoint (for game servers to report status)
  app.post('/api/servers/:id/heartbeat', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { currentPlayers, secret } = req.body;

      const server = await getGameServer(id);
      if (!server) {
        return res.status(404).json({ success: false, error: 'Server not found.' });
      }

      // TODO: Validate secret/auth token
      // For now, just update the heartbeat

      const { updateServerHeartbeat } = await import('../database/unified');
      await updateServerHeartbeat(id, currentPlayers || 0);

      return res.json({ success: true });
    } catch (error) {
      console.error('[API] Heartbeat error:', error);
      return res.status(500).json({ success: false, error: 'Heartbeat failed.' });
    }
  });

  return app;
}

export function startApiServer(app: express.Application): void {
  const port = process.env.PORT || process.env.API_PORT || 3000;

  app.listen(port, () => {
    console.log(`[API] Server listening on port ${port}`);
  });
}
