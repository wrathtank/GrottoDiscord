import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { LinkedWallet, VerificationSession } from '../types';

// Determine database location based on environment
const isHeroku = !!process.env.DYNO;
const DATA_DIR = process.env.DATABASE_PATH || (isHeroku ? '/tmp' : path.join(process.cwd(), 'data'));
const DB_PATH = path.join(DATA_DIR, 'grotto.db');

let db: Database;

// Auto-save interval (save to disk every 30 seconds if there are changes)
let saveTimer: NodeJS.Timeout | null = null;
let hasChanges = false;

function saveDatabase(): void {
  if (db && hasChanges) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
      hasChanges = false;
    } catch (error) {
      console.error('[Database] Failed to save:', error);
    }
  }
}

function markChanged(): void {
  hasChanges = true;
}

export async function initDatabase(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Warn about ephemeral storage on Heroku
  if (isHeroku && !process.env.DATABASE_PATH) {
    console.warn('[Database] WARNING: Running on Heroku with ephemeral storage!');
    console.warn('[Database] Wallet links will be lost when dyno restarts.');
    console.warn('[Database] Consider using a persistent database addon.');
  }

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      console.log('[Database] Loaded existing database');
    } catch (error) {
      console.warn('[Database] Failed to load existing database, creating new one');
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Create tables - supports multiple wallets per user
  // wallet_address is unique (one wallet = one user), discord_id is not (one user = many wallets)
  db.run(`
    CREATE TABLE IF NOT EXISTS linked_wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      wallet_address TEXT UNIQUE NOT NULL,
      linked_at INTEGER NOT NULL,
      last_verified INTEGER NOT NULL,
      signature TEXT,
      nonce TEXT
    )
  `);

  // Migration: remove old unique constraint on discord_id if it exists
  // SQLite doesn't support dropping constraints, so we just continue
  // The new UNIQUE on wallet_address will be enforced on new inserts

  db.run(`
    CREATE TABLE IF NOT EXISTS verification_sessions (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      nonce TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      wallet_address TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS role_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      assigned_at INTEGER NOT NULL,
      last_checked INTEGER NOT NULL,
      UNIQUE(discord_id, role_id)
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_wallets_discord ON linked_wallets(discord_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_wallets_address ON linked_wallets(wallet_address)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_discord ON verification_sessions(discord_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_roles_discord ON role_assignments(discord_id)`);

  // Save initial state
  saveDatabase();

  // Set up auto-save every 30 seconds
  saveTimer = setInterval(saveDatabase, 30000);

  // Save on process exit
  process.on('beforeExit', saveDatabase);
  process.on('SIGINT', () => {
    saveDatabase();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    saveDatabase();
    process.exit(0);
  });

  console.log('[Database] Initialized successfully');
}

// Get most recent wallet for a user (backwards compatibility)
export function getLinkedWallet(discordId: string): LinkedWallet | null {
  const stmt = db.prepare(`
    SELECT id, discord_id as discordId, wallet_address as walletAddress,
           linked_at as linkedAt, last_verified as lastVerified,
           signature, nonce
    FROM linked_wallets WHERE discord_id = ?
    ORDER BY linked_at DESC LIMIT 1
  `);
  stmt.bind([discordId]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as LinkedWallet;
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

// Get ALL wallets for a user
export function getLinkedWallets(discordId: string): LinkedWallet[] {
  const stmt = db.prepare(`
    SELECT id, discord_id as discordId, wallet_address as walletAddress,
           linked_at as linkedAt, last_verified as lastVerified,
           signature, nonce
    FROM linked_wallets WHERE discord_id = ?
    ORDER BY linked_at ASC
  `);
  stmt.bind([discordId]);

  const wallets: LinkedWallet[] = [];
  while (stmt.step()) {
    wallets.push(stmt.getAsObject() as unknown as LinkedWallet);
  }
  stmt.free();
  return wallets;
}

export function getWalletByAddress(address: string): LinkedWallet | null {
  const stmt = db.prepare(`
    SELECT id, discord_id as discordId, wallet_address as walletAddress,
           linked_at as linkedAt, last_verified as lastVerified,
           signature, nonce
    FROM linked_wallets WHERE LOWER(wallet_address) = LOWER(?)
  `);
  stmt.bind([address]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as LinkedWallet;
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function linkWallet(
  discordId: string,
  walletAddress: string,
  signature?: string,
  nonce?: string
): void {
  const now = Date.now();
  const normalizedAddress = walletAddress.toLowerCase();

  // Check if this specific wallet is already linked
  const existingWallet = getWalletByAddress(normalizedAddress);

  if (existingWallet) {
    // Update existing wallet link (same user re-verifying)
    db.run(
      `UPDATE linked_wallets SET last_verified = ?, signature = ?, nonce = ? WHERE LOWER(wallet_address) = ?`,
      [now, signature || null, nonce || null, normalizedAddress]
    );
  } else {
    // Add new wallet for user
    db.run(
      `INSERT INTO linked_wallets (discord_id, wallet_address, linked_at, last_verified, signature, nonce) VALUES (?, ?, ?, ?, ?, ?)`,
      [discordId, normalizedAddress, now, now, signature || null, nonce || null]
    );
  }
  markChanged();
}

// Unlink a specific wallet or all wallets for a user
export function unlinkWallet(discordId: string, walletAddress?: string): boolean {
  if (walletAddress) {
    // Unlink specific wallet
    const existing = getWalletByAddress(walletAddress);
    if (!existing || existing.discordId !== discordId) return false;

    db.run('DELETE FROM linked_wallets WHERE LOWER(wallet_address) = LOWER(?)', [walletAddress]);
  } else {
    // Unlink all wallets
    const existing = getLinkedWallet(discordId);
    if (!existing) return false;

    db.run('DELETE FROM linked_wallets WHERE discord_id = ?', [discordId]);
  }
  markChanged();
  return true;
}

// Count wallets for a user
export function getWalletCount(discordId: string): number {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM linked_wallets WHERE discord_id = ?');
  stmt.bind([discordId]);
  stmt.step();
  const count = (stmt.getAsObject() as { count: number }).count;
  stmt.free();
  return count;
}

export function updateLastVerified(discordId: string): void {
  db.run('UPDATE linked_wallets SET last_verified = ? WHERE discord_id = ?', [Date.now(), discordId]);
  markChanged();
}

export function createVerificationSession(
  id: string,
  discordId: string,
  nonce: string,
  expiryMinutes: number = 10
): VerificationSession {
  const now = Date.now();
  const expiresAt = now + expiryMinutes * 60 * 1000;

  db.run(
    `INSERT INTO verification_sessions (id, discord_id, nonce, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [id, discordId, nonce, now, expiresAt]
  );
  markChanged();

  return { id, discordId, nonce, createdAt: now, expiresAt };
}

export function getVerificationSession(id: string): VerificationSession | null {
  const stmt = db.prepare(`
    SELECT id, discord_id as discordId, nonce, created_at as createdAt,
           expires_at as expiresAt, wallet_address as walletAddress
    FROM verification_sessions WHERE id = ?
  `);
  stmt.bind([id]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as VerificationSession;
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function deleteVerificationSession(id: string): void {
  db.run('DELETE FROM verification_sessions WHERE id = ?', [id]);
  markChanged();
}

export function cleanExpiredSessions(): number {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM verification_sessions WHERE expires_at < ?');
  countStmt.bind([Date.now()]);
  countStmt.step();
  const count = (countStmt.getAsObject() as { count: number }).count;
  countStmt.free();

  if (count > 0) {
    db.run('DELETE FROM verification_sessions WHERE expires_at < ?', [Date.now()]);
    markChanged();
  }

  return count;
}

export function recordRoleAssignment(discordId: string, roleId: string): void {
  const now = Date.now();

  // Check if exists
  const stmt = db.prepare('SELECT id FROM role_assignments WHERE discord_id = ? AND role_id = ?');
  stmt.bind([discordId, roleId]);
  const exists = stmt.step();
  stmt.free();

  if (exists) {
    db.run(
      'UPDATE role_assignments SET last_checked = ? WHERE discord_id = ? AND role_id = ?',
      [now, discordId, roleId]
    );
  } else {
    db.run(
      'INSERT INTO role_assignments (discord_id, role_id, assigned_at, last_checked) VALUES (?, ?, ?, ?)',
      [discordId, roleId, now, now]
    );
  }
  markChanged();
}

export function removeRoleAssignment(discordId: string, roleId: string): void {
  db.run('DELETE FROM role_assignments WHERE discord_id = ? AND role_id = ?', [discordId, roleId]);
  markChanged();
}

export function getRoleAssignments(discordId: string): string[] {
  const stmt = db.prepare('SELECT role_id FROM role_assignments WHERE discord_id = ?');
  stmt.bind([discordId]);

  const roles: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { role_id: string };
    roles.push(row.role_id);
  }
  stmt.free();

  return roles;
}

export function getAllLinkedWallets(): LinkedWallet[] {
  const stmt = db.prepare(`
    SELECT id, discord_id as discordId, wallet_address as walletAddress,
           linked_at as linkedAt, last_verified as lastVerified,
           signature, nonce
    FROM linked_wallets
  `);

  const wallets: LinkedWallet[] = [];
  while (stmt.step()) {
    wallets.push(stmt.getAsObject() as unknown as LinkedWallet);
  }
  stmt.free();

  return wallets;
}

export function getDatabase(): Database {
  return db;
}

export function forceSave(): void {
  saveDatabase();
}
