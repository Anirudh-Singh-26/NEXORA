import { WALLET_NETWORK_CONFIG } from '../wallet/network-config.ts'
import { solanaDevnetTxUrl } from '../network/testnet.ts'

/**
 * Chains for which NEXORA asks Alchemy's Transfers API (`alchemy_getAssetTransfers`) for a wallet's history, keyed by
 * EVM chain ID. Only networks that Alchemy's Transfers API documentation names are listed (Ethereum, Optimism, Polygon,
 * Base, Arbitrum One, Ethereum Sepolia). Linea is supported by NEXORA's balance/token layer but is NOT listed because
 * Transfers API support for it was not confirmed: it is shown as "not supported" instead of being guessed. Extending
 * this table is the only change needed once support is confirmed. Shared by the server proxy and the browser.
 *
 * `explorer` is the block-explorer origin for the chain (kept identical to src/lib/blockchain/networks.ts; a test
 * enforces that). Explorer links are only ever built from this fixed table, never from provider-supplied strings.
 */
export interface ActivityChain {
  /** Alchemy endpoint slug: https://<slug>.g.alchemy.com/v2/<key> */
  alchemy: string
  name: string
  explorer: string
  nativeSymbol: string
}

export const ACTIVITY_CHAINS: Readonly<Record<number, ActivityChain>> = Object.fromEntries(
  [WALLET_NETWORK_CONFIG.evm.ethereum, WALLET_NETWORK_CONFIG.evm.optimism, WALLET_NETWORK_CONFIG.evm.polygon, WALLET_NETWORK_CONFIG.evm.base, WALLET_NETWORK_CONFIG.evm.arbitrum, WALLET_NETWORK_CONFIG.evm.sepolia]
    .filter((network) => 'alchemySlug' in network)
    .map((network) => [network.chainId, { alchemy: network.alchemySlug, name: network.shortName, explorer: network.explorerUrl, nativeSymbol: network.nativeCurrency.symbol }]),
) as Record<number, ActivityChain>

export function isActivityChain(chainId: unknown): chainId is number {
  return typeof chainId === 'number' && Number.isSafeInteger(chainId) && Object.prototype.hasOwnProperty.call(ACTIVITY_CHAINS, chainId)
}

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/
const SOLANA_SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/

/** Explorer link for an EVM transaction, or null for an unsupported chain or malformed hash. */
export function evmTxUrl(chainId: number, hash: string): string | null {
  if (!isActivityChain(chainId) || !TX_HASH_RE.test(hash)) return null
  return `${ACTIVITY_CHAINS[chainId].explorer}/tx/${hash.toLowerCase()}`
}

/** Explorer link for an EVM address, or null for an unsupported chain or malformed address. */
export function evmAddressUrl(chainId: number, address: string): string | null {
  if (!isActivityChain(chainId) || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null
  return `${ACTIVITY_CHAINS[chainId].explorer}/address/${address.toLowerCase()}`
}

/** Solana Devnet explorer link (`?cluster=devnet`) for a transaction signature, or null when it is not a well-formed signature. */
export function solanaTxUrl(signature: string): string | null {
  return solanaDevnetTxUrl(signature)
}

export const SOLANA_SIGNATURE_PATTERN = SOLANA_SIGNATURE_RE
