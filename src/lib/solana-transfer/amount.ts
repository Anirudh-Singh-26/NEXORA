/**
 * Pure validation and arithmetic for a native SOL transfer. All money is bigint lamports (1 SOL = 1,000,000,000
 * lamports); floating point is never used. No React, no I/O.
 */
import { isSolanaAddress, lamportsToSol } from '../solana-balance/solana-balance.ts'

export const LAMPORTS_PER_SOL = 1_000_000_000n
/** Hard ceiling for one NEXORA transfer: a Devnet-sized safety net, far above any faucet balance. */
export const SOL_TRANSFER_MAX_LAMPORTS = 1_000_000n * LAMPORTS_PER_SOL
/** The System Program address: lamports sent to it are not recoverable. */
export const SYSTEM_PROGRAM_ADDRESS = '11111111111111111111111111111111'

export type AmountResult = { ok: true; lamports: bigint } | { ok: false; message: string }

/** Parses what the user typed ("0.5", "1", ".25") into lamports. Positive, at most 9 decimals, no signs or exponents. */
export function parseSolAmount(text: string): AmountResult {
  const value = text.trim()
  if (value === '') return { ok: false, message: 'Enter an amount in SOL.' }
  if (value.startsWith('-')) return { ok: false, message: 'The amount must be greater than zero.' }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(value)) return { ok: false, message: 'Use digits and one decimal point only, for example 0.5.' }
  const [whole, fraction = ''] = value.split('.')
  if (fraction.length > 9) return { ok: false, message: 'SOL has at most 9 decimal places.' }
  const lamports = BigInt(whole === '' ? '0' : whole) * LAMPORTS_PER_SOL + BigInt(fraction.padEnd(9, '0') || '0')
  if (lamports <= 0n) return { ok: false, message: 'The amount must be greater than zero.' }
  if (lamports > SOL_TRANSFER_MAX_LAMPORTS) return { ok: false, message: 'That amount is above what NEXORA will send in one transfer.' }
  return { ok: true, lamports }
}

export type RecipientResult = { ok: true; address: string } | { ok: false; message: string }

/** Validates a recipient: a real 32-byte base58 public key, not the sender, not the System Program. */
export function validateSolRecipient(text: string, ownAddress: string | null): RecipientResult {
  const value = text.trim()
  if (value === '') return { ok: false, message: 'Enter a recipient address.' }
  if (/^0x/i.test(value)) return { ok: false, message: 'That looks like an Ethereum address. Enter a Solana address.' }
  if (!isSolanaAddress(value)) return { ok: false, message: 'That is not a valid Solana address (base58, 32–44 characters).' }
  if (value === SYSTEM_PROGRAM_ADDRESS) return { ok: false, message: 'That is the System Program address; SOL sent there cannot be recovered.' }
  if (ownAddress && value === ownAddress) return { ok: false, message: 'That is your own address. Enter a different recipient.' }
  return { ok: true, address: value }
}

/** What the server said about the chain right before a send. Every number is lamports. */
export interface ChainSnapshot {
  balance: bigint
  fee: bigint
  /** Minimum balance of a zero-data account (an account must hold this much or be empty). */
  rentExemptMinimum: bigint
  /** The recipient's current balance; null when it was not looked up. 0 means the account does not exist yet. */
  recipientBalance: bigint | null
}

/** The most that can be sent while still paying the fee, never negative. */
export function maxSendable(balance: bigint, fee: bigint): bigint {
  return balance > fee ? balance - fee : 0n
}

export function formatSol(lamports: bigint): string {
  return lamportsToSol(lamports)
}

/**
 * Null when the transfer can be afforded, otherwise a plain-language reason. Covers the amount, the fee, the rent-exempt
 * rule for the sender (it may end with exactly 0 or at least the rent-exempt minimum) and for a brand-new recipient.
 */
export function checkAffordability(lamports: bigint, snapshot: ChainSnapshot | null): string | null {
  if (!snapshot) return 'Your balance has not loaded yet, so the amount cannot be checked.'
  const { balance, fee, rentExemptMinimum, recipientBalance } = snapshot
  if (lamports + fee > balance) {
    return `Not enough SOL. This transfer needs ${formatSol(lamports + fee)} SOL (amount plus a ${formatSol(fee)} SOL network fee) and you have ${formatSol(balance)} SOL.`
  }
  const remaining = balance - lamports - fee
  if (remaining !== 0n && remaining < rentExemptMinimum) {
    return `This would leave ${formatSol(remaining)} SOL, below the ${formatSol(rentExemptMinimum)} SOL an account must keep. Send less, or send the maximum so the account is emptied.`
  }
  if (recipientBalance === 0n && lamports < rentExemptMinimum) {
    return `The recipient has no SOL yet, so the first transfer must be at least ${formatSol(rentExemptMinimum)} SOL to open the account.`
  }
  return null
}
