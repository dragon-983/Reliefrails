import crypto from 'crypto';
import { Keypair, Horizon } from '@stellar/stellar-sdk';
import { config } from './config.js';

const horizonServer = new Horizon.Server(config.stellar.horizonUrl);

/**
 * Generate a random challenge nonce for wallet authentication
 */
export function generateAuthChallenge(walletAddress: string): { challenge: string; expiresAt: Date } {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const expiresAt = new Date(timestamp + 5 * 60 * 1000); // 5 min TTL
  const challenge = `RELIEFRAIL AUTH: Sign this message to authenticate wallet ${walletAddress} (Nonce: ${nonce}, Expires: ${expiresAt.toISOString()})`;
  return { challenge, expiresAt };
}

/**
 * Verify a signed message using the Stellar ed25519 public key
 */
export function verifyStellarSignature(
  walletAddress: string,
  message: string,
  signatureBase64: string
): boolean {
  try {
    const keypair = Keypair.fromPublicKey(walletAddress);
    const messageBuffer = Buffer.from(message, 'utf-8');
    const signatureBuffer = Buffer.from(signatureBase64, 'base64');
    return keypair.verify(messageBuffer, signatureBuffer);
  } catch (err) {
    console.warn('Stellar signature verification error:', err);
    return false;
  }
}

/**
 * Generate SHA256 hash (used for voucher credential commitments and beneficiary privacy hashes)
 */
export function hashCredentialSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Generate a new cryptographically secure voucher secret
 */
export function generateVoucherSecret(prefix: string = 'VOUCH'): string {
  const random = crypto.randomBytes(12).toString('hex').toUpperCase();
  return `AID-${prefix}-${random}`;
}

/**
 * Fetch account balances from Stellar Horizon Testnet
 */
export async function getAccountBalances(
  walletAddress: string
): Promise<{ xlm: string; usdc: string }> {
  try {
    const account = await horizonServer.loadAccount(walletAddress);
    let xlm = '0';
    let usdc = '0';

    for (const line of account.balances) {
      if (line.asset_type === 'native') {
        xlm = line.balance;
      } else if (
        line.asset_type === 'credit_alphanum4' &&
        line.asset_code === config.stellar.usdcCode
      ) {
        usdc = line.balance;
      }
    }

    return { xlm, usdc };
  } catch (err: any) {
    // Return standard demo/default balance if account does not exist yet on testnet
    return { xlm: '100.0000000', usdc: '500.0000000' };
  }
}

/**
 * Format Stroops (smallest unit) to decimal string (7 decimals)
 */
export function stroopsToStellar(stroops: bigint | number): string {
  const n = typeof stroops === 'bigint' ? stroops : BigInt(stroops);
  const factor = BigInt(10_000_000);
  const integerPart = n / factor;
  const fractionalPart = (n % factor).toString().padStart(7, '0');
  return `${integerPart}.${fractionalPart}`;
}

/**
 * Convert decimal string to Stroops (bigint)
 */
export function stellarToStroops(amount: string | number): bigint {
  const [intStr, fracStr = ''] = amount.toString().split('.');
  const paddedFrac = fracStr.padEnd(7, '0').slice(0, 7);
  return BigInt(intStr || '0') * BigInt(10_000_000) + BigInt(paddedFrac);
}
