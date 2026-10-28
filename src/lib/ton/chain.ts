import { isRawTonAddress } from './address.ts'

/**
 * TON network identity (read-only). Pure helpers: no wallet, React or browser imports.
 *
 * TON Connect reports the network of the connected account as a string in `account.chain`
 * (CHAIN.MAINNET = "-239", CHAIN.TESTNET = "-3" in @tonconnect/sdk; see docs.ton.org TON Connect pages).
 * The value comes from the wallet itself. Testnet is claimed ONLY for an exact "-3"; every other value
 * (including a missing value, a number, or a differently formatted string) is "unknown", never testnet.
 */

export const TON_MAINNET_CHAIN = '-239'
export const TON_TESTNET_CHAIN = '-3'

export type TonNetworkKind = 'testnet' | 'mainnet' | 'unknown'

export interface TonNetworkIdentity {
  kind: TonNetworkKind
  /** The chain value exactly as the wallet reported it, or null when none was reported. */
  chain: string | null
  /** True only when the wallet reported exactly the TON testnet chain value. */
  verifiedTestnet: boolean
}

export const TON_NETWORK_LABEL: Readonly<Record<TonNetworkKind, string>> = {
  testnet: 'TON Testnet',
  mainnet: 'TON Mainnet',
  unknown: 'Unknown TON network',
}

export function classifyTonChain(chain: unknown): TonNetworkIdentity {
  if (chain === TON_TESTNET_CHAIN) return { kind: 'testnet', chain, verifiedTestnet: true }
  if (chain === TON_MAINNET_CHAIN) return { kind: 'mainnet', chain, verifiedTestnet: false }
  return { kind: 'unknown', chain: typeof chain === 'string' ? chain : null, verifiedTestnet: false }
}

export type TonBalanceBlockReason = 'restoring' | 'disconnected' | 'mainnet' | 'unknown-network' | 'invalid-address'

export type TonBalanceGate =
  | { allowed: true; address: string }
  | { allowed: false; reason: TonBalanceBlockReason }

/**
 * The single decision point for "may a testnet balance request be made?". It is allowed only when the
 * connection has been restored, a wallet is connected with a well-formed raw address, and the wallet
 * positively reported TON testnet. Mainnet and unknown networks never pass.
 */
export function evaluateTonBalanceGate(input: { restored: boolean; chain: unknown; address: string | null }): TonBalanceGate {
  if (!input.restored) return { allowed: false, reason: 'restoring' }
  if (input.address === null || input.address === '') return { allowed: false, reason: 'disconnected' }
  const identity = classifyTonChain(input.chain)
  if (identity.kind === 'mainnet') return { allowed: false, reason: 'mainnet' }
  if (!identity.verifiedTestnet) return { allowed: false, reason: 'unknown-network' }
  if (!isRawTonAddress(input.address)) return { allowed: false, reason: 'invalid-address' }
  return { allowed: true, address: input.address }
}
