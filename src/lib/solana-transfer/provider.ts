/**
 * Defensive access to the connected wallet's signing capability. NEXORA asks the wallet to SIGN a transaction it built
 * (`signTransaction`) and relays the signed bytes to Devnet itself. Signing happens inside the wallet; NEXORA never holds
 * a key. The provider shape comes from Reown's Solana adapter (an internal dependency detail), so everything is probed
 * at runtime and a missing capability becomes a clear error rather than a crash.
 */
import { TransferError } from './errors.ts'

export type SignTransaction = (transaction: unknown) => Promise<unknown>

/** The base58 public key a provider reports, or null when it does not expose one. */
export function providerAddress(provider: unknown): string | null {
  if (typeof provider !== 'object' || provider === null) return null
  const key = (provider as { publicKey?: unknown }).publicKey
  if (typeof key === 'string') return key
  if (typeof key === 'object' && key !== null && typeof (key as { toBase58?: unknown }).toBase58 === 'function') {
    try { return String((key as { toBase58: () => string }).toBase58()) } catch { return null }
  }
  return null
}

/**
 * Returns the provider's `signTransaction` bound to it. Throws TransferError('wallet-unsupported') when the provider
 * cannot sign, and TransferError('wallet-mismatch') when it reports a different account than the one NEXORA is showing.
 */
export function resolveSigner(provider: unknown, expectedAddress: string): SignTransaction {
  if (typeof provider !== 'object' || provider === null || typeof (provider as { signTransaction?: unknown }).signTransaction !== 'function') throw new TransferError('wallet-unsupported')
  const reported = providerAddress(provider)
  if (reported !== null && reported !== expectedAddress) throw new TransferError('wallet-mismatch')
  const target = provider as { signTransaction: SignTransaction }
  return (transaction) => target.signTransaction(transaction)
}

/** Standard base64 of raw bytes without relying on Node's Buffer. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
