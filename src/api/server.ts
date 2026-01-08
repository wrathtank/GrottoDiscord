import express, { Request, Response } from 'express';
import cors from 'cors';
import { BlockchainService } from '../services/blockchain';
import { BotConfig } from '../types';
import {
  getVerificationSession,
  deleteVerificationSession,
  linkWallet,
  getWalletByAddress,
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

  // Enable CORS for all origins (needed for web verification)
  app.use(cors({
    origin: '*',
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

      // Verify roles and assign them
      const results = await blockchain.verifyAllRoles(config.roles, walletAddress);
      const qualifiedRoles = results.filter((r) => r.qualified);

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

  return app;
}

export function startApiServer(app: express.Application): void {
  const port = process.env.PORT || process.env.API_PORT || 3000;

  app.listen(port, () => {
    console.log(`[API] Server listening on port ${port}`);
  });
}
