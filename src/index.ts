import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { GrottoBot } from './bot';
import { initDatabase, cleanExpiredSessions, getAllLinkedWallets } from './database/unified';
import { initApiServer, startApiServer } from './api/server';
import { BotConfig } from './types';

function loadConfig(): BotConfig {
  // First, try loading from BOT_CONFIG environment variable (for Heroku/cloud)
  if (process.env.BOT_CONFIG) {
    try {
      console.log('[Config] Loading from BOT_CONFIG environment variable');
      return JSON.parse(process.env.BOT_CONFIG) as BotConfig;
    } catch (error) {
      console.error('[Config] Failed to parse BOT_CONFIG env var:', error);
      process.exit(1);
    }
  }

  // Fall back to config file (for local development)
  const configPath = path.join(process.cwd(), 'config', 'config.json');

  if (!fs.existsSync(configPath)) {
    console.error('[Config] No configuration found!');
    console.error('[Config] Either set BOT_CONFIG env var or copy config/config.example.json to config/config.json');
    process.exit(1);
  }

  try {
    console.log('[Config] Loading from config/config.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData) as BotConfig;
  } catch (error) {
    console.error('[Config] Failed to parse config.json:', error);
    process.exit(1);
  }
}

function validateEnv(): void {
  const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('[Env] Missing required environment variables:');
    missing.forEach((key) => console.error(`  - ${key}`));
    console.error('[Env] Copy .env.example to .env and configure it.');
    process.exit(1);
  }
}

function validateConfig(config: BotConfig): void {
  if (!config.chains || Object.keys(config.chains).length === 0) {
    console.error('[Config] No chains configured!');
    console.error('[Config] Add at least one chain to the "chains" section of your config.');
    process.exit(1);
  }

  // Validate each chain has required fields
  for (const [chainKey, chain] of Object.entries(config.chains)) {
    if (!chain.rpcPrimary) {
      console.error(`[Config] Chain "${chainKey}" is missing rpcPrimary`);
      process.exit(1);
    }
    if (!chain.chainId) {
      console.error(`[Config] Chain "${chainKey}" is missing chainId`);
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  console.log('=================================');
  console.log('  Grotto Discord Verification Bot');
  console.log('=================================\n');

  validateEnv();

  const config = loadConfig();
  validateConfig(config);

  const chainCount = Object.keys(config.chains).length;
  console.log(`[Config] Loaded ${config.roles.length} role(s) across ${chainCount} chain(s)`);

  await initDatabase();

  const cleaned = await cleanExpiredSessions();
  if (cleaned > 0) {
    console.log(`[Database] Cleaned ${cleaned} expired session(s)`);
  }

  const bot = new GrottoBot(
    process.env.DISCORD_TOKEN!,
    process.env.DISCORD_CLIENT_ID!,
    config,
    process.env.DISCORD_GUILD_ID
  );

  const cleanup = async () => {
    console.log('\n[Main] Received shutdown signal...');
    if (refreshInterval) clearInterval(refreshInterval);
    if (securityInterval) clearInterval(securityInterval);
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    await bot.start();
    console.log('[Main] Bot is now running!');

    // Start API server for web verification
    const apiApp = initApiServer(bot.getClient(), bot.getBlockchain(), config);
    startApiServer(apiApp);

    // Start scheduled role refresh (every hour by default, or from config)
    const refreshHours = config.verification.refreshIntervalHours || 24;
    const refreshMs = refreshHours * 60 * 60 * 1000;

    console.log(`[Scheduler] Role refresh scheduled every ${refreshHours} hour(s)`);

    refreshInterval = setInterval(async () => {
      console.log('[Scheduler] Starting scheduled role refresh...');
      await refreshAllWallets(bot, config);
    }, refreshMs);

    // Start security reminder messages (every 30 minutes)
    const securityChannelId = '1417516224379748403';
    const securityIntervalMs = 30 * 60 * 1000; // 30 minutes

    console.log(`[Scheduler] Security reminders scheduled every 30 minutes`);

    securityInterval = setInterval(async () => {
      await sendSecurityReminder(bot.getClient(), securityChannelId);
    }, securityIntervalMs);

    // Send first security message after 5 minutes
    setTimeout(async () => {
      await sendSecurityReminder(bot.getClient(), securityChannelId);
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('[Main] Failed to start bot:', error);
    process.exit(1);
  }
}

let refreshInterval: NodeJS.Timeout | null = null;
let securityInterval: NodeJS.Timeout | null = null;

// Security reminder messages - ticket channel
const TICKET_CHANNEL = '1452326140847853629';
const securityMessages = [
  {
    title: '🔒 Security Reminder',
    description: `**No team member will ever DM you first!**\n\nIf someone DMs you claiming to be from The Grotto team, it's a scam. Block and report them immediately.\n\nNeed help? Open a ticket in <#${TICKET_CHANNEL}>`,
    color: 0xff0033
  },
  {
    title: '⚠️ Stay Safe',
    description: `**Never share your seed phrase or private keys!**\n\nNo legitimate team member, admin, or bot will ever ask for your seed phrase. Anyone who does is trying to steal your funds.\n\nFor support, open a ticket in <#${TICKET_CHANNEL}>`,
    color: 0xff6600
  },
  {
    title: '🛡️ Protect Yourself',
    description: `**Always verify links before clicking!**\n\nScammers create fake websites that look identical to real ones. Double-check URLs and only use official links from announcements.\n\nQuestions? Open a ticket in <#${TICKET_CHANNEL}>`,
    color: 0xff0033
  },
  {
    title: '🚨 Scam Alert',
    description: `**Beware of fake giveaways and airdrops!**\n\nIf it sounds too good to be true, it probably is. Official giveaways are only announced in official channels.\n\nReport suspicious activity in <#${TICKET_CHANNEL}>`,
    color: 0xff3300
  }
];

async function sendSecurityReminder(client: any, channelId: string): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.log('[Security] Could not find security channel:', channelId);
      return;
    }

    // Pick a random message
    const message = securityMessages[Math.floor(Math.random() * securityMessages.length)];

    await channel.send({
      embeds: [{
        title: message.title,
        description: message.description,
        color: message.color,
        footer: {
          text: 'The Grotto • Stay vigilant, stay safe'
        },
        timestamp: new Date().toISOString()
      }]
    });

    console.log('[Security] Sent security reminder to channel');
  } catch (error) {
    console.error('[Security] Failed to send reminder:', error);
  }
}

async function refreshAllWallets(bot: GrottoBot, config: BotConfig): Promise<void> {
  try {
    const allWallets = await getAllLinkedWallets();
    const client = bot.getClient();
    const blockchain = bot.getBlockchain();

    if (allWallets.length === 0) {
      console.log('[Scheduler] No wallets to refresh');
      return;
    }

    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) {
      console.log('[Scheduler] No DISCORD_GUILD_ID set, skipping refresh');
      return;
    }

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      console.log('[Scheduler] Could not find guild:', guildId);
      return;
    }

    // Fetch all guild roles to populate the cache
    await guild.roles.fetch();

    // Group wallets by Discord user for multi-wallet verification
    const walletsByUser = new Map<string, string[]>();
    for (const wallet of allWallets) {
      const existing = walletsByUser.get(wallet.discordId) || [];
      existing.push(wallet.walletAddress);
      walletsByUser.set(wallet.discordId, existing);
    }

    let processed = 0;
    let errors = 0;
    let rolesAdded = 0;
    let rolesRemoved = 0;
    let skippedDueToError = 0;

    for (const [discordId, walletAddresses] of walletsByUser) {
      try {
        // Add a small delay between users to avoid rate limiting
        if (processed > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Verify all wallets for this user together (balances are summed)
        let results = await blockchain.verifyAllRolesMultiWallet(config.roles, walletAddresses);

        // Retry once if there were errors
        const hasErrors = results.some(r => r.error);
        if (hasErrors) {
          console.log(`[Scheduler] Retrying verification for user ${discordId.slice(0, 8)}... due to errors`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          results = await blockchain.verifyAllRolesMultiWallet(config.roles, walletAddresses);
        }

        const member = await guild.members.fetch(discordId).catch(() => null);

        if (member) {
          // First pass: collect all Discord role IDs that the user qualifies for
          const qualifiedDiscordRoleIds = new Set<string>();
          for (const result of results) {
            if (result.qualified) {
              const roleConfig = config.roles.find((r) => r.id === result.roleId);
              if (roleConfig) {
                qualifiedDiscordRoleIds.add(roleConfig.discordRoleId);
              }
            }
          }

          // Second pass: add/remove roles
          for (const result of results) {
            const roleConfig = config.roles.find((r) => r.id === result.roleId);
            if (!roleConfig) continue;

            const discordRole = guild.roles.cache.get(roleConfig.discordRoleId);
            if (!discordRole) continue;

            const hasRole = member.roles.cache.has(discordRole.id);

            if (result.qualified && !hasRole) {
              await member.roles.add(discordRole);
              rolesAdded++;
            } else if (!result.qualified && hasRole && config.verification.autoRevokeOnFailure) {
              // IMPORTANT: Don't remove role if there was an error checking
              // Only remove if we successfully verified they don't qualify
              if (result.error) {
                console.log(`[Scheduler] Skipping role removal for user ${discordId.slice(0, 8)}... - verification error`);
                skippedDueToError++;
              } else if (qualifiedDiscordRoleIds.has(roleConfig.discordRoleId)) {
                // Don't remove if another config entry qualified for same Discord role
                console.log(`[Scheduler] Skipping role removal for user ${discordId.slice(0, 8)}... - qualified via another config`);
              } else {
                await member.roles.remove(discordRole);
                rolesRemoved++;
              }
            }
          }
        }
        processed++;
      } catch (error) {
        errors++;
        console.error(`[Scheduler] Error processing user ${discordId.slice(0, 8)}...:`, error);
      }
    }

    console.log(`[Scheduler] Refresh complete: ${processed} users (${allWallets.length} wallets), +${rolesAdded} roles, -${rolesRemoved} roles, ${skippedDueToError} skipped (errors), ${errors} failures`);
  } catch (error) {
    console.error('[Scheduler] Error during scheduled refresh:', error);
  }
}

main();
