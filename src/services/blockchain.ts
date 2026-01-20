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

// Mapping of NFT contracts to their staking contracts
// When checking ERC721 balance, also check staked balance and combine them
const NFT_STAKING_MAP: Record<string, { stakingContract: string; method: string }> = {
  // Analog Distortions NFT -> AD Staking Contract
  '0x0a337be2ea71e3aea9c82d45b036ac6a6123b6d0': {
    stakingContract: '0x51697170f78136c8d143b0013cf5b229ade70757',
    method: 'stakers',
  },
};

// Mapping of ERC20 tokens to their equivalent tokens on other chains
// When checking balance, also check equivalent tokens and combine them
// Key: contractAddress (lowercase), Value: array of equivalent contracts on other chains
// Options: native (gas token), staked (staking contract with stakers method)
interface CrossChainToken {
  contractAddress?: string;  // Optional if native is true
  chainId: string;
  native?: boolean;  // If true, check native gas token balance via getBalance()
  staked?: boolean;  // If true, contractAddress is a staking contract, use stakers() method
}

const ERC20_CROSS_CHAIN_MAP: Record<string, CrossChainToken[]> = {
  // HERESY on AVAX -> also check Wrapped HERESY, Native HERESY, and Staked HERESY on Grotto L1
  '0x432d38f83a50ec77c409d086e97448794cf76dcf': [
    { contractAddress: '0xfa99b368b5fc1f5a061bc393dff73be8a097667d', chainId: 'grotto' },  // Wrapped HERESY (wHERESY)
    { chainId: 'grotto', native: true },  // Native gas token on Grotto L1
    { contractAddress: '0x0eDc665115951c3838D399d89fDD647B02361588', chainId: 'grotto', staked: true },  // Staked native HERESY
  ],
  // Wrapped HERESY (wHERESY) on Grotto L1 -> also check HERESY on AVAX, native + staked on Grotto
  '0xfa99b368b5fc1f5a061bc393dff73be8a097667d': [
    { contractAddress: '0x432d38f83a50ec77c409d086e97448794cf76dcf', chainId: 'avax' },  // HERESY on AVAX C-Chain
    { chainId: 'grotto', native: true },  // Native gas token on Grotto L1
    { contractAddress: '0x0eDc665115951c3838D399d89fDD647B02361588', chainId: 'grotto', staked: true },  // Staked native HERESY
  ],
};

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
    const normalizedContract = contractAddress.toLowerCase();

    // Get balance on the primary chain
    let totalBalance = await this.withFallback(chainId, async (provider) => {
      const contract = new Contract(contractAddress, ERC20_ABI, provider);
      const balance = await contract.balanceOf(walletAddress);
      console.log(`[Blockchain] ERC20 balanceOf ${contractAddress.slice(0, 10)}... for ${walletAddress.slice(0, 10)}... on ${chainId || this.defaultChain}: ${balance.toString()}`);
      return balance;
    });

    // Check if this token has cross-chain equivalents
    const crossChainTokens = ERC20_CROSS_CHAIN_MAP[normalizedContract];
    if (crossChainTokens && crossChainTokens.length > 0) {
      for (const equivalent of crossChainTokens) {
        // Skip if the equivalent is on the same chain we already checked
        if (equivalent.chainId === (chainId || this.defaultChain)) continue;

        // Check if we have this chain configured
        if (!this.chains.has(equivalent.chainId)) {
          console.log(`[Blockchain] Cross-chain ${equivalent.chainId} not configured, skipping`);
          continue;
        }

        try {
          let crossChainBalance: bigint;

          if (equivalent.native) {
            // Check native gas token balance
            crossChainBalance = await this.withFallback(equivalent.chainId, async (provider) => {
              const balance = await provider.getBalance(walletAddress);
              console.log(`[Blockchain] Native balance for ${walletAddress.slice(0, 10)}... on ${equivalent.chainId}: ${balance.toString()}`);
              return balance;
            });
            console.log(`[Blockchain] Adding native balance ${crossChainBalance.toString()} from ${equivalent.chainId}`);
          } else if (equivalent.staked && equivalent.contractAddress) {
            // Check staked balance via stakers() method
            const STAKING_ABI = ['function stakers(address) view returns (uint256 amountStaked, uint256 conditionId, uint256 lastUpdate, uint256 unclaimedRewards)'];
            crossChainBalance = await this.withFallback(equivalent.chainId, async (provider) => {
              const contract = new Contract(equivalent.contractAddress!, STAKING_ABI, provider);
              const result = await contract.stakers(walletAddress);
              const amountStaked = result[0];
              console.log(`[Blockchain] Staked balance for ${walletAddress.slice(0, 10)}... on ${equivalent.chainId} (${equivalent.contractAddress!.slice(0, 10)}...): ${amountStaked.toString()}`);
              return amountStaked;
            });
            console.log(`[Blockchain] Adding staked balance ${crossChainBalance.toString()} from ${equivalent.chainId}`);
          } else if (equivalent.contractAddress) {
            // Check ERC20 contract balance
            crossChainBalance = await this.withFallback(equivalent.chainId, async (provider) => {
              const contract = new Contract(equivalent.contractAddress!, ERC20_ABI, provider);
              const balance = await contract.balanceOf(walletAddress);
              console.log(`[Blockchain] ERC20 cross-chain balanceOf ${equivalent.contractAddress!.slice(0, 10)}... for ${walletAddress.slice(0, 10)}... on ${equivalent.chainId}: ${balance.toString()}`);
              return balance;
            });
            console.log(`[Blockchain] Adding cross-chain balance ${crossChainBalance.toString()} from ${equivalent.chainId}`);
          } else {
            continue;  // Invalid config, skip
          }

          totalBalance = totalBalance + crossChainBalance;
        } catch (error) {
          console.warn(`[Blockchain] Failed to check cross-chain balance on ${equivalent.chainId}, continuing with primary balance:`, error);
          // Continue without cross-chain balance if it fails
        }
      }

      console.log(`[Blockchain] Total ERC20 balance (including cross-chain): ${totalBalance.toString()}`);
    }

    return totalBalance;
  }

  async getERC721Balance(contractAddress: string, walletAddress: string, chainId?: string): Promise<bigint> {
    const { primary, secondary } = this.getProviders(chainId);
    const normalizedContract = contractAddress.toLowerCase();

    // Try primary RPC first
    let walletBalance: bigint;
    try {
      const contract = new Contract(contractAddress, ERC721_ABI, primary);
      walletBalance = await contract.balanceOf(walletAddress);
      console.log(`[Blockchain] ERC721 balanceOf ${contractAddress.slice(0, 10)}... for ${walletAddress.slice(0, 10)}... on ${chainId || this.defaultChain} (primary): ${walletBalance.toString()}`);

      // If balance is 0 and we have a secondary RPC, double-check
      if (walletBalance === 0n && secondary) {
        console.log(`[Blockchain] ERC721 balance is 0, double-checking with secondary RPC...`);
        const secondaryContract = new Contract(contractAddress, ERC721_ABI, secondary);
        const secondaryBalance = await secondaryContract.balanceOf(walletAddress);
        console.log(`[Blockchain] ERC721 balanceOf ${contractAddress.slice(0, 10)}... for ${walletAddress.slice(0, 10)}... on ${chainId || this.defaultChain} (secondary): ${secondaryBalance.toString()}`);

        if (secondaryBalance > 0n) {
          console.log(`[Blockchain] Secondary RPC shows balance, using that instead`);
          walletBalance = secondaryBalance;
        }
      }
    } catch (primaryError) {
      if (secondary) {
        console.warn(`[Blockchain] Primary RPC failed for ERC721 check on "${chainId || this.defaultChain}", trying secondary`);
        const contract = new Contract(contractAddress, ERC721_ABI, secondary);
        walletBalance = await contract.balanceOf(walletAddress);
        console.log(`[Blockchain] ERC721 balanceOf ${contractAddress.slice(0, 10)}... for ${walletAddress.slice(0, 10)}... on ${chainId || this.defaultChain} (secondary fallback): ${walletBalance.toString()}`);
      } else {
        throw primaryError;
      }
    }

    // Check if this NFT has an associated staking contract
    // If so, also check staked balance and combine them
    const stakingInfo = NFT_STAKING_MAP[normalizedContract];
    if (stakingInfo) {
      try {
        const stakedBalance = await this.getStakedBalance(
          stakingInfo.stakingContract,
          walletAddress,
          stakingInfo.method,
          chainId
        );
        console.log(`[Blockchain] Adding staked balance ${stakedBalance.toString()} to wallet balance ${walletBalance.toString()}`);
        const totalBalance = walletBalance + stakedBalance;
        console.log(`[Blockchain] Total ERC721 + staked balance: ${totalBalance.toString()}`);
        return totalBalance;
      } catch (stakingError) {
        console.warn(`[Blockchain] Failed to check staking contract, using wallet balance only:`, stakingError);
        // If staking check fails, just return wallet balance
        return walletBalance;
      }
    }

    return walletBalance;
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

  // Verify roles across multiple wallets, summing balances
  async verifyAllRolesMultiWallet(
    roles: RoleConfig[],
    walletAddresses: string[]
  ): Promise<VerificationResult[]> {
    if (walletAddresses.length === 0) {
      return [];
    }

    // If only one wallet, use the regular method
    if (walletAddresses.length === 1) {
      return this.verifyAllRoles(roles, walletAddresses[0]);
    }

    // For multiple wallets, we need to check each requirement across all wallets
    // and sum the balances
    const results: VerificationResult[] = [];

    for (const role of roles) {
      const requirementResults: RequirementResult[] = [];
      let hasError = false;

      for (const requirement of role.requirements) {
        let totalBalance = 0n;
        let anyError = false;

        // Sum balances across all wallets
        for (const wallet of walletAddresses) {
          try {
            const result = await this.checkRequirement(requirement, wallet);
            totalBalance += BigInt(result.actual);
            if (result.error) anyError = true;
          } catch {
            anyError = true;
          }
        }

        const minRequired = BigInt(requirement.minBalance);
        const passed = totalBalance >= minRequired;

        requirementResults.push({
          type: requirement.type,
          contractAddress: requirement.contractAddress,
          required: requirement.minBalance,
          actual: totalBalance.toString(),
          passed,
          error: anyError,
        });

        if (anyError) hasError = true;
      }

      let qualified: boolean;
      if (role.requireAll) {
        qualified = requirementResults.every((r) => r.passed);
      } else {
        qualified = requirementResults.some((r) => r.passed);
      }

      results.push({
        roleId: role.id,
        roleName: role.name,
        qualified,
        details: requirementResults,
        error: hasError,
      });
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
