import { LinkedWallet, VerificationSession } from '../types';
import * as sqlite from './index';
import * as supabase from './supabase';

// Determine which database to use
const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

export async function initDatabase(): Promise<void> {
  if (useSupabase) {
    console.log('[Database] Using Supabase for persistent storage');
    await supabase.initSupabase();
  } else {
    console.log('[Database] Using local SQLite storage');
    await sqlite.initDatabase();
  }
}

export async function getLinkedWallet(discordId: string): Promise<LinkedWallet | null> {
  if (useSupabase) {
    return supabase.getLinkedWallet(discordId);
  }
  return sqlite.getLinkedWallet(discordId);
}

// Get ALL wallets for a user
export async function getLinkedWallets(discordId: string): Promise<LinkedWallet[]> {
  if (useSupabase) {
    return supabase.getLinkedWallets(discordId);
  }
  return sqlite.getLinkedWallets(discordId);
}

export async function getWalletByAddress(address: string): Promise<LinkedWallet | null> {
  if (useSupabase) {
    return supabase.getWalletByAddress(address);
  }
  return sqlite.getWalletByAddress(address);
}

export async function getWalletCount(discordId: string): Promise<number> {
  if (useSupabase) {
    return supabase.getWalletCount(discordId);
  }
  return sqlite.getWalletCount(discordId);
}

export async function linkWallet(
  discordId: string,
  walletAddress: string,
  signature?: string,
  nonce?: string
): Promise<void> {
  if (useSupabase) {
    await supabase.linkWallet(discordId, walletAddress, signature, nonce);
  } else {
    sqlite.linkWallet(discordId, walletAddress, signature, nonce);
  }
}

export async function unlinkWallet(discordId: string, walletAddress?: string): Promise<boolean> {
  if (useSupabase) {
    return supabase.unlinkWallet(discordId, walletAddress);
  }
  return sqlite.unlinkWallet(discordId, walletAddress);
}

export async function updateLastVerified(discordId: string): Promise<void> {
  if (useSupabase) {
    await supabase.updateLastVerified(discordId);
  } else {
    sqlite.updateLastVerified(discordId);
  }
}

export async function createVerificationSession(
  id: string,
  discordId: string,
  nonce: string,
  expiryMinutes?: number
): Promise<VerificationSession> {
  if (useSupabase) {
    return supabase.createVerificationSession(id, discordId, nonce, expiryMinutes);
  }
  return sqlite.createVerificationSession(id, discordId, nonce, expiryMinutes);
}

export async function getVerificationSession(id: string): Promise<VerificationSession | null> {
  if (useSupabase) {
    return supabase.getVerificationSession(id);
  }
  return sqlite.getVerificationSession(id);
}

export async function deleteVerificationSession(id: string): Promise<void> {
  if (useSupabase) {
    await supabase.deleteVerificationSession(id);
  } else {
    sqlite.deleteVerificationSession(id);
  }
}

export async function cleanExpiredSessions(): Promise<number> {
  if (useSupabase) {
    return supabase.cleanExpiredSessions();
  }
  return sqlite.cleanExpiredSessions();
}

export async function recordRoleAssignment(discordId: string, roleId: string): Promise<void> {
  if (useSupabase) {
    await supabase.recordRoleAssignment(discordId, roleId);
  } else {
    sqlite.recordRoleAssignment(discordId, roleId);
  }
}

export async function removeRoleAssignment(discordId: string, roleId: string): Promise<void> {
  if (useSupabase) {
    await supabase.removeRoleAssignment(discordId, roleId);
  } else {
    sqlite.removeRoleAssignment(discordId, roleId);
  }
}

export async function getRoleAssignments(discordId: string): Promise<string[]> {
  if (useSupabase) {
    return supabase.getRoleAssignments(discordId);
  }
  return sqlite.getRoleAssignments(discordId);
}

export async function getAllLinkedWallets(): Promise<LinkedWallet[]> {
  if (useSupabase) {
    return supabase.getAllLinkedWallets();
  }
  return sqlite.getAllLinkedWallets();
}

export function isUsingSupabase(): boolean {
  return useSupabase;
}
