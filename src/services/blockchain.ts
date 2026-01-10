import { ethers, JsonRpcProvider, Contract, formatUnits } from 'ethers';
import {
  TokenRequirement,
  RequirementResult,
  VerificationResult,
  RoleConfig,
  ChainConfig,
} from '../types';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

const ERC1155_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
];

const ERC404_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function erc20BalanceOf(address owner) view returns (uint256)',
  'function erc721BalanceOf(address owner) view returns (uint256)',
];

interface ChainProviders {
  primary: JsonRpcProvider;
  secondary?: JsonRpcProvider;
  config: ChainConfig;
}

export class BlockchainService {
  private chains: Map<string, ChainProviders> = new Map();
  private defaultChain: string;
  private customAbis: Record<string, string[]>;

  constructor(
    chainsConfig: Record<string, ChainConfig>,
    customAbis?: Record<string, string[]>
  ) {
    this.customAbis = customAbis || {};

    // Initialize providers for each chain
    const chainKeys = Object.keys(chainsConfig);
    if (chainKeys.length === 0) {
      throw new Error('At least one chain must be configured');
    }

    this.defaultChain = chainKeys[0];

    for (const [chainKey, config] of Object.entries(chainsConfig)) {
      const primary = new JsonRpcProvider(config.rpcPrimary, config.chainId);
      const secondary = config.rpcSecondary
        ? new JsonRpcProvider(config.rpcSecondary, config.chainId)
        : undefined;

      this.chains.set(chainKey, { primary, secondary, config });
      console.log(`[Blockchain] Initialized chain "${chainKey}" (${config.name}) - Chain ID: ${config.chainId}`);
    }

    console.log(`[Blockchain] Service initialized with ${this.chains.size} chain(s)`);
  }

  private getProviders(chainId?: string): ChainProviders {
    const key = chainId || this.defaultChain;
    const providers = this.chains.get(key);
    if (!providers) {
      throw new Error(`Chain "${key}" not configured. Available chains: ${Array.from(this.chains.keys()).join(', ')}`);
    }
    return providers;
  }

  private async withFallback<T>(
    chainId: string | undefined,
    operation: (provider: JsonRpcProvider) => Promise<T>
  ): Promise<T> {
    const { primary, secondary } = this.getProviders(chainId);

    try {
      return await operation(primary);
    } catch (primaryError) {
      if (secondary) {
        console.warn(`[Blockchain] Primary RPC failed for chain "${chainId || this.defaultChain}", trying secondary`);
        try {
          return await operation(secondary);
        } catch (secondaryError) {
          console.error(`[Blockchain] Both RPCs failed for chain "${chainId || this.defaultChain}"`);
          throw new Error(`All RPC endpoints failed for chain "${chainId || this.defaultChain}"`);
        }
      }
      throw primaryError;
    }
  }

  async getERC20Balance(contractAddress: string, walletAddress: string, chainId?: string): Promise<bigint> {
    return this.withFallback(chainId, async (provider) => {
      const contract = new Contract(contractAddress, ERC20_ABI, provider);
      return await contract.balanceOf(walletAddress);
    });
  }

  async getERC721Balance(contractAddress: string, walletAddress: string, chainId?: string): Promise<bigint> {
    const { primary, secondary } = this.getProviders(chainId);

    // Try primary RPC first
    try {
      const contract = new Contract(contractAddress, ERC721_ABI, primary);
      const balance = await contract.balanceOf(walletAddress);
      console.log(`[Blockchain] ERC721 balanceOf ${contractAddress.slice(0, 10)}... for ${walletAddress.slice(0, 10)}... on ${chainId || this.defaultChain} (primary): ${balance.toString()}`);

      // If balance is 0 and we have a secondary RPC, double-check
      // This helps catch cases where the primary RPC returns stale/incorrect data
      if (balance === 0n && secondary) {
        console.log(`[Blockchain] ERC721 balance is 0, double-checking with secondary RPC...`);
        const secondaryContract = new Contract(contractAddress, ERC721_ABI, secondary);
        const secondaryBalance = await secondaryContract.balanceOf(walletAddress);
        console.log(`[Blockchain] ERC721 balanceOf ${contractAddress.slice(0, 10)}... for ${walletAddress.slice(0, 10)}... on ${chainId || this.defaultChain} (secondary): ${secondaryBalance.toString()}`);

        // If secondary shows a balance but primary didn't, use the secondary result
        if (secondaryBalance > 0n) {
          console.log(`[Blockchain] Secondary RPC shows balance, using that instead`);
          return secondaryBalance;
        }
      }

      return balance;
    } catch (primaryError) {
      // Primary failed, try secondary
      if (secondary) {
        console.warn(`[Blockchain] Primary RPC failed for ERC721 check on "${chainId || this.defaultChain}", trying secondary`);
        const contract = new Contract(contractAddress, ERC721_ABI, secondary);
        const balance = await contract.balanceOf(walletAddress);
        console.log(`[Blockchain] ERC721 balanceOf ${contractAddress.slice(0, 10)}... for ${walletAddress.slice(0, 10)}... on ${chainId || this.defaultChain} (secondary fallback): ${balance.toString()}`);
        return balance;
      }
      throw primaryError;
    }
  }

  async getERC1155Balance(
    contractAddress: string,
    walletAddress: string,
    tokenId: string,
    chainId?: string
  ): Promise<bigint> {
    return this.withFallback(chainId, async (provider) => {
      const contract = new Contract(contractAddress, ERC1155_ABI, provider);
      return await contract.balanceOf(walletAddress, tokenId);
    });
  }

  async getERC404Balance(contractAddress: string, walletAddress: string, chainId?: string): Promise<bigint> {
    return this.withFallback(chainId, async (provider) => {
      const contract = new Contract(contractAddress, ERC404_ABI, provider);
      try {
        return await contract.erc20BalanceOf(walletAddress);
      } catch {
        return await contract.balanceOf(walletAddress);
      }
    });
  }

  async getStakedBalance(
    contractAddress: string,
    walletAddress: string,
    method: string = 'stakedBalance',
    chainId?: string
  ): Promise<bigint> {
    const stakingAbi = this.customAbis['staking'] || [
      `function ${method}(address account) view returns (uint256)`,
    ];

    const { primary, secondary } = this.getProviders(chainId);

    const checkWithProvider = async (provider: JsonRpcProvider, label: string): Promise<bigint> => {
      const contract = new Contract(contractAddress, stakingAbi, provider);

      if (typeof contract[method] === 'function') {
        const result = await contract[method](walletAddress);
        let balance: bigint;
        if (Array.isArray(result)) {
          balance = BigInt(result[0]);
        } else {
          balance = BigInt(result);
        }
        console.log(`[Blockchain] Staked ${method} ${contractAddress.slice(0, 10)}... for ${walletAddress.slice(0, 10)}... on ${chainId || this.defaultChain} (${label}): ${balance.toString()}`);
        return balance;
      }

      for (const abiEntry of stakingAbi) {
        const match = abiEntry.match(/function (\w+)\(/);
        if (match && typeof contract[match[1]] === 'function') {
          try {
            const result = await contract[match[1]](walletAddress);
            let balance: bigint;
            if (Array.isArray(result)) {
              balance = BigInt(result[0]);
            } else {
              balance = BigInt(result);
            }
            console.log(`[Blockchain] Staked ${match[1]} ${contractAddress.slice(0, 10)}... for ${walletAddress.slice(0, 10)}... on ${chainId || this.defaultChain} (${label}): ${balance.toString()}`);
            return balance;
          } catch {
            continue;
          }
        }
      }

      throw new Error(`No valid staking method found for contract ${contractAddress}`);
    };

    try {
      const balance = await checkWithProvider(primary, 'primary');

      // If balance is 0 and we have a secondary, double-check
      if (balance === 0n && secondary) {
        console.log(`[Blockchain] Staked balance is 0, double-checking with secondary RPC...`);
        try {
          const secondaryBalance = await checkWithProvider(secondary, 'secondary');
          if (secondaryBalance > 0n) {
            console.log(`[Blockchain] Secondary RPC shows staked balance, using that instead`);
            return secondaryBalance;
          }
        } catch {
          // Secondary check failed, stick with primary result
        }
      }

      return balance;
    } catch (primaryError) {
      if (secondary) {
        console.warn(`[Blockchain] Primary RPC failed for staked check on "${chainId || this.defaultChain}", trying secondary`);
        return await checkWithProvider(secondary, 'secondary fallback');
      }
      throw primaryError;
    }
  }

  async checkRequirement(
    requirement: TokenRequirement,
    walletAddress: string
  ): Promise<RequirementResult> {
    let actualBalance: bigint;
    const chainId = requirement.chainId;

    try {
      switch (requirement.type) {
        case 'erc20':
          actualBalance = await this.getERC20Balance(requirement.contractAddress, walletAddress, chainId);
          break;
        case 'erc721':
          actualBalance = await this.getERC721Balance(requirement.contractAddress, walletAddress, chainId);
          break;
        case 'erc1155':
          if (!requirement.tokenId) {
            throw new Error('tokenId required for ERC1155');
          }
          actualBalance = await this.getERC1155Balance(
            requirement.contractAddress,
            walletAddress,
            requirement.tokenId,
            chainId
          );
          break;
        case 'erc404':
          actualBalance = await this.getERC404Balance(requirement.contractAddress, walletAddress, chainId);
          break;
        case 'staked':
          actualBalance = await this.getStakedBalance(
            requirement.contractAddress,
            walletAddress,
            requirement.method,
            chainId
          );
          break;
        default:
          throw new Error(`Unknown requirement type: ${requirement.type}`);
      }

      const minRequired = BigInt(requirement.minBalance);
      const passed = actualBalance >= minRequired;

      return {
        type: requirement.type,
        contractAddress: requirement.contractAddress,
        required: requirement.minBalance,
        actual: actualBalance.toString(),
        passed,
      };
    } catch (error) {
      console.error(`[Blockchain] Error checking requirement on chain "${chainId || this.defaultChain}":`, error);
      return {
        type: requirement.type,
        contractAddress: requirement.contractAddress,
        required: requirement.minBalance,
        actual: '0',
        passed: false,
        error: true, // Mark as error so we don't incorrectly remove roles
      };
    }
  }

  async verifyRole(role: RoleConfig, walletAddress: string): Promise<VerificationResult> {
    // Run all requirement checks in parallel
    const results = await Promise.all(
      role.requirements.map(req => this.checkRequirement(req, walletAddress))
    );

    // Check if any requirement had an error
    const hasError = results.some((r) => r.error);

    let qualified: boolean;
    if (role.requireAll) {
      qualified = results.every((r) => r.passed);
    } else {
      qualified = results.some((r) => r.passed);
    }

    return {
      roleId: role.id,
      roleName: role.name,
      qualified,
      details: results,
      error: hasError, // Propagate error flag
    };
  }

  async verifyAllRoles(
    roles: RoleConfig[],
    walletAddress: string
  ): Promise<VerificationResult[]> {
    // Run all role checks in parallel for speed and to avoid
    // sequential timeout issues with cold RPC connections
    const results = await Promise.all(
      roles.map(role => this.verifyRole(role, walletAddress))
    );

    return results;
  }

  verifySignature(message: string, signature: string, expectedAddress: string): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      console.error('[Blockchain] Signature verification failed:', error);
      return false;
    }
  }

  generateSignatureMessage(nonce: string, timestamp: number): string {
    const template = process.env.SIGNATURE_MESSAGE ||
      'Sign this message to verify your wallet ownership for The Grotto Discord.\n\nNonce: {nonce}\nTimestamp: {timestamp}';

    return template
      .replace('{nonce}', nonce)
      .replace('{timestamp}', timestamp.toString());
  }

  formatBalance(balance: string, decimals: number = 18): string {
    try {
      return formatUnits(balance, decimals);
    } catch {
      return balance;
    }
  }

  async getNetworkInfo(chainId?: string): Promise<{ chainId: number; blockNumber: number; name: string }> {
    const { config } = this.getProviders(chainId);
    return this.withFallback(chainId, async (provider) => {
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      return {
        chainId: Number(network.chainId),
        blockNumber,
        name: config.name,
      };
    });
  }

  async healthCheck(): Promise<Record<string, { primary: boolean; secondary: boolean; name: string }>> {
    const results: Record<string, { primary: boolean; secondary: boolean; name: string }> = {};

    for (const [chainKey, { primary, secondary, config }] of this.chains) {
      const checkProvider = async (provider: JsonRpcProvider): Promise<boolean> => {
        try {
          await provider.getBlockNumber();
          return true;
        } catch {
          return false;
        }
      };

      const primaryOk = await checkProvider(primary);
      const secondaryOk = secondary ? await checkProvider(secondary) : true;

      results[chainKey] = {
        primary: primaryOk,
        secondary: secondaryOk,
        name: config.name,
      };
    }

    return results;
  }

  getChainNames(): string[] {
    return Array.from(this.chains.keys());
  }
}
