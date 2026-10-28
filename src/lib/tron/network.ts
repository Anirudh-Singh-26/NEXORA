import { WALLET_NETWORK_CONFIG } from '../wallet/network-config.ts'

/**
 * TRON network identity (read-only). Pure helpers, no wallet or browser imports.
 *
 * Identity comes from the chain ID TronLink reports: the last 8 hex digits of the
 * genesis block ID of the node the wallet is using (the TronWallet Adapter reads
 * block 0 and derives it). A display label is never used as proof.
 */

export const SHASTA_CHAIN_ID = WALLET_NETWORK_CONFIG.tron.shasta.chainId
export const MAINNET_CHAIN_ID = WALLET_NETWORK_CONFIG.tron.mainnet.chainId
export const NILE_CHAIN_ID = WALLET_NETWORK_CONFIG.tron.nile.chainId

/** Official Shasta HTTP API (https://developers.tron.network/docs/networks). Fixed: never user-supplied. */
export const SHASTA_API_URL = WALLET_NETWORK_CONFIG.tron.shasta.apiBaseUrl
export const SHASTA_EXPLORER_URL = WALLET_NETWORK_CONFIG.tron.shasta.explorerUrl

export type TronNetworkKind = 'shasta' | 'mainnet' | 'nile' | 'unknown'

export interface TronNetworkIdentity {
  kind: TronNetworkKind
  /** Normalised (lower-case) chain ID as reported, or null when none was reported. */
  chainId: string | null
  /** True only when the chain ID AND the adapter's own network type both say Shasta. */
  verifiedShasta: boolean
  /** True when the wallet's network type label disagrees with its chain ID. */
  inconsistent: boolean
}

const KIND_BY_CHAIN_ID: Readonly<Record<string, Exclude<TronNetworkKind, 'unknown'>>> = {
  [SHASTA_CHAIN_ID]: 'shasta',
  [MAINNET_CHAIN_ID]: 'mainnet',
  [NILE_CHAIN_ID]: 'nile',
}

const KIND_BY_TYPE_LABEL: Readonly<Record<string, TronNetworkKind>> = {
  shasta: 'shasta',
  mainnet: 'mainnet',
  nile: 'nile',
  unknown: 'unknown',
}

export const TRON_NETWORK_LABEL: Readonly<Record<TronNetworkKind, string>> = {
  shasta: 'TRON Shasta testnet',
  mainnet: 'TRON Mainnet',
  nile: 'TRON Nile testnet',
  unknown: 'Unknown TRON network',
}

/**
 * Classify what a wallet reported. Shasta is claimed only when the chain ID matches
 * Shasta's AND the adapter's `networkType` label (if present) agrees. Anything else
 * that is not a known chain ID is "unknown"; a label that contradicts the chain ID
 * makes the result "unknown" and `inconsistent`, never Shasta.
 */
export function classifyTronNetwork(input: { chainId?: string | null; networkType?: string | null }): TronNetworkIdentity {
  const chainId = typeof input.chainId === 'string' && input.chainId.trim() !== '' ? input.chainId.trim().toLowerCase() : null
  const byId = chainId ? KIND_BY_CHAIN_ID[chainId] ?? 'unknown' : 'unknown'
  const label = typeof input.networkType === 'string' ? input.networkType.trim().toLowerCase() : null
  const byLabel = label ? KIND_BY_TYPE_LABEL[label] ?? 'unknown' : null

  if (byId === 'unknown') {
    // An unrecognised chain ID is unknown whatever the label says (a label alone is not proof).
    return { kind: 'unknown', chainId, verifiedShasta: false, inconsistent: byLabel !== null && byLabel !== 'unknown' }
  }
  if (byLabel !== null && byLabel !== byId) {
    return { kind: 'unknown', chainId, verifiedShasta: false, inconsistent: true }
  }
  return { kind: byId, chainId, verifiedShasta: byId === 'shasta', inconsistent: false }
}

export function shastaAddressUrl(address: string): string {
  return `${SHASTA_EXPLORER_URL}/#/address/${encodeURIComponent(address)}`
}

export function isTxId(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value)
}

/** Shasta explorer link for a transaction. Throws on anything that is not a 64-hex transaction ID. */
export function shastaTxUrl(txId: string): string {
  if (!isTxId(txId)) throw new RangeError('Not a valid transaction ID')
  return `${SHASTA_EXPLORER_URL}/#/transaction/${txId}`
}
