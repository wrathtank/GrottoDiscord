export type RequirementType = 'erc20' | 'erc721' | 'erc1155' | 'erc404' | 'staked';

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface RoleEmbed {
  title: string;
  description: string;
  color?: string;
  thumbnail?: string;
  image?: string;
  fields?: EmbedField[];
  footer?: string;
}

export interface TokenRequirement {
  type: RequirementType;
  contractAddress: string;
  minBalance: string;
  chainId?: string;  // Which chain to check (matches key in chains config)
  symbol?: string;
  decimals?: number;
  name?: string;
  tokenId?: string;
  method?: string;
}

export interface RoleConfig {
  id: string;
  name: string;
  discordRoleId: string;
  description: string;
  image?: string;
  color?: string;
  requirements: TokenRequirement[];
  requireAll?: boolean;
  successMessage?: string;
  assignEmbed?: RoleEmbed;
}

export interface VerificationConfig {
  enabled: boolean;
  requireSignature: boolean;
  refreshIntervalHours: number;
  autoRevokeOnFailure: boolean;
}

export interface MessagesConfig {
  verificationStart: string;
  walletConnected: string;
  verificationSuccess: string;
  verificationFailed: string;
  alreadyVerified: string;
  notLinked: string;
}

export interface ChainConfig {
  name: string;
  chainId: number;
  rpcPrimary: string;
  rpcSecondary?: string;
}

export interface BotConfig {
  verification: VerificationConfig;
  chains: Record<string, ChainConfig>;  // Key is chain identifier (e.g., "avax", "grotto")
  roles: RoleConfig[];
  customAbis?: Record<string, string[]>;
  messages: MessagesConfig;
}

export interface LinkedWallet {
  id: number;
  discordId: string;
  walletAddress: string;
  linkedAt: number;
  lastVerified: number;
  signature?: string;
  nonce?: string;
}

export interface VerificationSession {
  id: string;
  discordId: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
  walletAddress?: string;
}

export interface VerificationResult {
  roleId: string;
  roleName: string;
  qualified: boolean;
  details: RequirementResult[];
}

export interface RequirementResult {
  type: RequirementType;
  contractAddress: string;
  required: string;
  actual: string;
  passed: boolean;
}

export interface RpcConfig {
  primary: string;
  secondary: string;
  chainId: number;
}
