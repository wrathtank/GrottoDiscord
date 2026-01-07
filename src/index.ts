import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { GrottoBot } from './bot';
import { initDatabase, cleanExpiredSessions } from './database';
import { BotConfig, RpcConfig } from './types';

function loadConfig(): BotConfig {
  const configPath = path.join(process.cwd(), 'config', 'config.json');

  if (!fs.existsSync(configPath)) {
    console.error('[Config] config/config.json not found!');
    console.error('[Config] Copy config/config.example.json to config/config.json and configure it.');
    process.exit(1);
  }

  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData) as BotConfig;
  } catch (error) {
    console.error('[Config] Failed to parse config.json:', error);
    process.exit(1);
  }
}

function validateEnv(): void {
  const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'RPC_URL_PRIMARY', 'RPC_URL_SECONDARY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('[Env] Missing required environment variables:');
    missing.forEach((key) => console.error(`  - ${key}`));
    console.error('[Env] Copy .env.example to .env and configure it.');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log('=================================');
  console.log('  Grotto Discord Verification Bot');
  console.log('=================================\n');

  validateEnv();

  const config = loadConfig();
  console.log(`[Config] Loaded ${config.roles.length} role configuration(s)`);

  initDatabase();

  const cleaned = cleanExpiredSessions();
  if (cleaned > 0) {
    console.log(`[Database] Cleaned ${cleaned} expired session(s)`);
  }

  const rpcConfig: RpcConfig = {
    primary: process.env.RPC_URL_PRIMARY!,
    secondary: process.env.RPC_URL_SECONDARY!,
    chainId: parseInt(process.env.CHAIN_ID || '1'),
  };

  const bot = new GrottoBot(
    process.env.DISCORD_TOKEN!,
    process.env.DISCORD_CLIENT_ID!,
    rpcConfig,
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
