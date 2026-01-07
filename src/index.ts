import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { GrottoBot } from './bot';
import { initDatabase, cleanExpiredSessions } from './database';
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

  const cleaned = cleanExpiredSessions();
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
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    await bot.start();
    console.log('[Main] Bot is now running!');
  } catch (error) {
    console.error('[Main] Failed to start bot:', error);
    process.exit(1);
  }
}

main();
