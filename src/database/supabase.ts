import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LinkedWallet, VerificationSession } from '../types';

let supabase: SupabaseClient;

export async function initSupabase(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY environment variables are required');
  }

  supabase = createClient(supabaseUrl, supabaseKey);

  // Test connection
  const { error } = await supabase.from('linked_wallets').select('count').limit(1);

  // If table doesn't exist, that's okay - we'll create it
  if (error && !error.message.includes('does not exist')) {
    console.warn('[Supabase] Connection test warning:', error.message);
  }

  console.log('[Supabase] Connected successfully');
}

export async function getLinkedWallet(discordId: string): Promise<LinkedWallet | null> {
  const { data, error } = await supabase
    .from('linked_wallets')
    .select('*')
    .eq('discord_id', discordId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    discordId: data.discord_id,
    walletAddress: data.wallet_address,
    linkedAt: new Date(data.linked_at).getTime(),
    lastVerified: new Date(data.last_verified).getTime(),
    signature: data.signature,
    nonce: data.nonce,
  };
}

export async function getWalletByAddress(address: string): Promise<LinkedWallet | null> {
  const { data, error } = await supabase
    .from('linked_wallets')
    .select('*')
    .ilike('wallet_address', address)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    discordId: data.discord_id,
    walletAddress: data.wallet_address,
    linkedAt: new Date(data.linked_at).getTime(),
    lastVerified: new Date(data.last_verified).getTime(),
    signature: data.signature,
    nonce: data.nonce,
  };
}

export async function linkWallet(
  discordId: string,
  walletAddress: string,
  signature?: string,
  nonce?: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('linked_wallets')
    .upsert({
      discord_id: discordId,
      wallet_address: walletAddress.toLowerCase(),
      linked_at: now,
      last_verified: now,
      signature: signature || null,
      nonce: nonce || null,
    }, {
      onConflict: 'discord_id',
    });

  if (error) {
    console.error('[Supabase] Error linking wallet:', error);
    throw error;
  }
}

export async function unlinkWallet(discordId: string): Promise<boolean> {
  const { error, count } = await supabase
    .from('linked_wallets')
    .delete()
    .eq('discord_id', discordId);

  if (error) {
    console.error('[Supabase] Error unlinking wallet:', error);
    return false;
  }

  return (count || 0) > 0;
}

export async function updateLastVerified(discordId: string): Promise<void> {
  const { error } = await supabase
    .from('linked_wallets')
    .update({ last_verified: new Date().toISOString() })
    .eq('discord_id', discordId);

  if (error) {
    console.error('[Supabase] Error updating last verified:', error);
  }
}

export async function createVerificationSession(
  id: string,
  discordId: string,
  nonce: string,
  expiryMinutes: number = 10
): Promise<VerificationSession> {
  const now = Date.now();
  const expiresAt = now + expiryMinutes * 60 * 1000;

  const { error } = await supabase
    .from('verification_sessions')
    .insert({
      id,
      discord_id: discordId,
      nonce,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
    });

  if (error) {
    console.error('[Supabase] Error creating session:', error);
    throw error;
  }

  return { id, discordId, nonce, createdAt: now, expiresAt };
}

export async function getVerificationSession(id: string): Promise<VerificationSession | null> {
  const { data, error } = await supabase
    .from('verification_sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    discordId: data.discord_id,
    nonce: data.nonce,
    createdAt: new Date(data.created_at).getTime(),
    expiresAt: new Date(data.expires_at).getTime(),
    walletAddress: data.wallet_address,
  };
}

export async function deleteVerificationSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('verification_sessions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Supabase] Error deleting session:', error);
  }
}

export async function cleanExpiredSessions(): Promise<number> {
  const { data, error } = await supabase
    .from('verification_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('[Supabase] Error cleaning sessions:', error);
    return 0;
  }

  return data?.length || 0;
}

export async function recordRoleAssignment(discordId: string, roleId: string): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('role_assignments')
    .upsert({
      discord_id: discordId,
      role_id: roleId,
      assigned_at: now,
      last_checked: now,
    }, {
      onConflict: 'discord_id,role_id',
    });

  if (error) {
    console.error('[Supabase] Error recording role assignment:', error);
  }
}

export async function removeRoleAssignment(discordId: string, roleId: string): Promise<void> {
  const { error } = await supabase
    .from('role_assignments')
    .delete()
    .eq('discord_id', discordId)
    .eq('role_id', roleId);

  if (error) {
    console.error('[Supabase] Error removing role assignment:', error);
  }
}

export async function getRoleAssignments(discordId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('role_assignments')
    .select('role_id')
    .eq('discord_id', discordId);

  if (error || !data) return [];

  return data.map((row) => row.role_id);
}

export async function getAllLinkedWallets(): Promise<LinkedWallet[]> {
  const { data, error } = await supabase
    .from('linked_wallets')
    .select('*');

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    discordId: row.discord_id,
    walletAddress: row.wallet_address,
    linkedAt: new Date(row.linked_at).getTime(),
    lastVerified: new Date(row.last_verified).getTime(),
    signature: row.signature,
    nonce: row.nonce,
  }));
}

export function getSupabaseClient(): SupabaseClient {
  return supabase;
}
