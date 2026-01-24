// Payment Verification Service
// Verifies HERESY token transfers on Grotto mainnet

import { ethers } from 'ethers';

// Grotto L1 configuration
const GROTTO_RPC = process.env.GROTTO_RPC || 'https://rpc.grotto.network';
const HERESY_TOKEN = '0xfa99b368b5fc1f5a061bc393dff73be8a097667d'; // wHERESY on Grotto

// ERC20 Transfer event signature
const TRANSFER_EVENT_TOPIC = ethers.id('Transfer(address,address,uint256)');

// Minimum ABI for reading transfer events
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
];

interface TransferVerification {
  verified: boolean;
  from?: string;
  to?: string;
  amount?: string;
  error?: string;
}

// Verify a HERESY token transfer transaction
export async function verifyHeresyTransfer(
  txHash: string,
  expectedFrom: string,
  expectedTo: string,
  expectedAmount: number // in HERESY (not wei)
): Promise<TransferVerification> {
  try {
    const provider = new ethers.JsonRpcProvider(GROTTO_RPC);

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return { verified: false, error: 'Transaction not found or not confirmed' };
    }

    if (receipt.status !== 1) {
      return { verified: false, error: 'Transaction failed' };
    }

    // Look for Transfer event from HERESY token
    const transferLog = receipt.logs.find(log =>
      log.address.toLowerCase() === HERESY_TOKEN.toLowerCase() &&
      log.topics[0] === TRANSFER_EVENT_TOPIC
    );

    if (!transferLog) {
      return { verified: false, error: 'No HERESY transfer found in transaction' };
    }

    // Decode the transfer event
    const iface = new ethers.Interface(ERC20_ABI);
    const decoded = iface.parseLog({
      topics: transferLog.topics as string[],
      data: transferLog.data,
    });

    if (!decoded) {
      return { verified: false, error: 'Failed to decode transfer event' };
    }

    const from = decoded.args[0].toLowerCase();
    const to = decoded.args[1].toLowerCase();
    const amountWei = decoded.args[2];
    const amountHeresy = parseFloat(ethers.formatEther(amountWei));

    // Verify sender
    if (from !== expectedFrom.toLowerCase()) {
      return {
        verified: false,
        from,
        to,
        amount: amountHeresy.toString(),
        error: `Wrong sender: expected ${expectedFrom}, got ${from}`,
      };
    }

    // Verify recipient (treasury)
    if (to !== expectedTo.toLowerCase()) {
      return {
        verified: false,
        from,
        to,
        amount: amountHeresy.toString(),
        error: `Wrong recipient: expected ${expectedTo}, got ${to}`,
      };
    }

    // Verify amount (allow 1% tolerance for rounding)
    const tolerance = expectedAmount * 0.01;
    if (amountHeresy < expectedAmount - tolerance) {
      return {
        verified: false,
        from,
        to,
        amount: amountHeresy.toString(),
        error: `Insufficient amount: expected ${expectedAmount}, got ${amountHeresy}`,
      };
    }

    console.log(`[Payment] Verified transfer: ${amountHeresy} HERESY from ${from.slice(0, 8)}... to treasury`);

    return {
      verified: true,
      from,
      to,
      amount: amountHeresy.toString(),
    };
  } catch (error) {
    console.error('[Payment] Verification error:', error);
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

// Get current HERESY balance of an address
export async function getHeresyBalance(address: string): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(GROTTO_RPC);
    const contract = new ethers.Contract(HERESY_TOKEN, ['function balanceOf(address) view returns (uint256)'], provider);
    const balance = await contract.balanceOf(address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('[Payment] Balance check error:', error);
    return '0';
  }
}
