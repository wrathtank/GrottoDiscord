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
    return this.withFallback(chainId, async (provider) => {
      const contract = new Contract(contractAddress, ERC721_ABI, provider);
      return await contract.balanceOf(walletAddress);
    });
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

    return this.withFallback(chainId, async (provider) => {
      const contract = new Contract(contractAddress, stakingAbi, provider);

      if (typeof contract[method] === 'function') {
        return await contract[method](walletAddress);
      }

      for (const abiEntry of stakingAbi) {
        const match = abiEntry.match(/function (\w+)\(/);
        if (match && typeof contract[match[1]] === 'function') {
          try {
            return await contract[match[1]](walletAddress);
          } catch {
            continue;
          }
        }
      }

      throw new Error(`No valid staking method found for contract ${contractAddress}`);
    });
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
      };
    }
  }

  async verifyRole(role: RoleConfig, walletAddress: string): Promise<VerificationResult> {
    const results: RequirementResult[] = [];

    for (const requirement of role.requirements) {
      const result = await this.checkRequirement(requirement, walletAddress);
      results.push(result);
    }

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
    };
  }

  async verifyAllRoles(
    roles: RoleConfig[],
    walletAddress: string
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const role of roles) {
      const result = await this.verifyRole(role, walletAddress);
      results.push(result);
    }

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
