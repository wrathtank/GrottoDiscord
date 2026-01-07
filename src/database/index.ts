import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { LinkedWallet, VerificationSession } from '../types';

// Determine database location based on environment
const isHeroku = !!process.env.DYNO;
const DATA_DIR = process.env.DATABASE_PATH || (isHeroku ? '/tmp' : path.join(process.cwd(), 'data'));
const DB_PATH = path.join(DATA_DIR, 'grotto.db');

let db: Database.Database;

export function initDatabase(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Warn about ephemeral storage on Heroku
  if (isHeroku && !process.env.DATABASE_PATH) {
    console.warn('[Database] WARNING: Running on Heroku with ephemeral storage!');
    console.warn('[Database] Wallet links will be lost when dyno restarts.');
    console.warn('[Database] Consider using a persistent database addon.');
  }

  db = new Database(DB_PATH);

  // Use DELETE journal mode on Heroku (WAL can cause issues with ephemeral storage)
  db.pragma(isHeroku ? 'journal_mode = DELETE' : 'journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS linked_wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      wallet_address TEXT NOT NULL,
      linked_at INTEGER NOT NULL,
      last_verified INTEGER NOT NULL,
      signature TEXT,
      nonce TEXT
    );

    CREATE TABLE IF NOT EXISTS verification_sessions (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      nonce TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      wallet_address TEXT
    );

    CREATE TABLE IF NOT EXISTS role_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      assigned_at INTEGER NOT NULL,
      last_checked INTEGER NOT NULL,
      UNIQUE(discord_id, role_id)
    );

    CREATE INDEX IF NOT EXISTS idx_wallets_discord ON linked_wallets(discord_id);
    CREATE INDEX IF NOT EXISTS idx_wallets_address ON linked_wallets(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_sessions_discord ON verification_sessions(discord_id);
    CREATE INDEX IF NOT EXISTS idx_roles_discord ON role_assignments(discord_id);
  `);

  console.log('[Database] Initialized successfully');
}

export function getLinkedWallet(discordId: string): LinkedWallet | null {
  const stmt = db.prepare(`
    SELECT id, discord_id as discordId, wallet_address as walletAddress,
           linked_at as linkedAt, last_verified as lastVerified,
           signature, nonce
    FROM linked_wallets WHERE discord_id = ?
  `);
  return stmt.get(discordId) as LinkedWallet | null;
}

export function getWalletByAddress(address: string): LinkedWallet | null {
  const stmt = db.prepare(`
    SELECT id, discord_id as discordId, wallet_address as walletAddress,
           linked_at as linkedAt, last_verified as lastVerified,
           signature, nonce
    FROM linked_wallets WHERE LOWER(wallet_address) = LOWER(?)
  `);
  return stmt.get(address) as LinkedWallet | null;
}

export function linkWallet(
  discordId: string,
  walletAddress: string,
  signature?: string,
  nonce?: string
): void {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO linked_wallets (discord_id, wallet_address, linked_at, last_verified, signature, nonce)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET
      wallet_address = excluded.wallet_address,
      last_verified = excluded.last_verified,
      signature = excluded.signature,
      nonce = excluded.nonce
  `);
  stmt.run(discordId, walletAddress.toLowerCase(), now, now, signature, nonce);
}

export function unlinkWallet(discordId: string): boolean {
  const stmt = db.prepare('DELETE FROM linked_wallets WHERE discord_id = ?');
  const result = stmt.run(discordId);
  return result.changes > 0;
}

export function updateLastVerified(discordId: string): void {
  const stmt = db.prepare('UPDATE linked_wallets SET last_verified = ? WHERE discord_id = ?');
  stmt.run(Date.now(), discordId);
}

export function createVerificationSession(
  id: string,
  discordId: string,
  nonce: string,
  expiryMinutes: number = 10
): VerificationSession {
  const now = Date.now();
  const expiresAt = now + expiryMinutes * 60 * 1000;

  const stmt = db.prepare(`
    INSERT INTO verification_sessions (id, discord_id, nonce, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, discordId, nonce, now, expiresAt);

  return { id, discordId, nonce, createdAt: now, expiresAt };
}

export function getVerificationSession(id: string): VerificationSession | null {
  const stmt = db.prepare(`
    SELECT id, discord_id as discordId, nonce, created_at as createdAt,
           expires_at as expiresAt, wallet_address as walletAddress
    FROM verification_sessions WHERE id = ?
  `);
  return stmt.get(id) as VerificationSession | null;
}

export function deleteVerificationSession(id: string): void {
  const stmt = db.prepare('DELETE FROM verification_sessions WHERE id = ?');
  stmt.run(id);
}

export function cleanExpiredSessions(): number {
  const stmt = db.prepare('DELETE FROM verification_sessions WHERE expires_at < ?');
  const result = stmt.run(Date.now());
  return result.changes;
}

export function recordRoleAssignment(discordId: string, roleId: string): void {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO role_assignments (discord_id, role_id, assigned_at, last_checked)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(discord_id, role_id) DO UPDATE SET last_checked = excluded.last_checked
  `);
  stmt.run(discordId, roleId, now, now);
}

export function removeRoleAssignment(discordId: string, roleId: string): void {
  const stmt = db.prepare('DELETE FROM role_assignments WHERE discord_id = ? AND role_id = ?');
  stmt.run(discordId, roleId);
}

export function getRoleAssignments(discordId: string): string[] {
  const stmt = db.prepare('SELECT role_id FROM role_assignments WHERE discord_id = ?');
  const rows = stmt.all(discordId) as { role_id: string }[];
  return rows.map(r => r.role_id);
}

export function getAllLinkedWallets(): LinkedWallet[] {
  const stmt = db.prepare(`
    SELECT id, discord_id as discordId, wallet_address as walletAddress,
           linked_at as linkedAt, last_verified as lastVerified,
           signature, nonce
    FROM linked_wallets
  `);
  return stmt.all() as LinkedWallet[];
}

export function getDatabase(): Database.Database {
  return db;
}
