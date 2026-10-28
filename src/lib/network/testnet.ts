import { WALLET_NETWORK_CONFIG } from '../wallet/network-config.ts'

/**
 * Single source of truth for the networks NEXORA supports for Ethereum and Solana: Sepolia and Devnet ONLY.
 * No React, no browser globals, so the browser, the wallet config and the server proxies (api/*) share it.
 *
 * Wallet connection (src/lib/wallet/config.ts), data reads (src/lib/blockchain, wallet-*), explorer links and the
 * transaction guards below all derive from these constants so they cannot disagree. TON and TRON are configured
 * separately (src/lib/ton, src/lib/tron) and are untouched.
 */

/** Ethereum Sepolia testnet. The only EVM chain NEXORA connects to, reads from or would submit transactions on. */
export const SEPOLIA_CHAIN_ID = WALLET_NETWORK_CONFIG.evm.sepolia.chainId
export const SEPOLIA_NAME = WALLET_NETWORK_CONFIG.evm.sepolia.name
export const SEPOLIA_EXPLORER_URL = WALLET_NETWORK_CONFIG.evm.sepolia.explorerUrl

/** Solana Devnet. The only Solana cluster NEXORA connects to, reads from or would submit transactions on. */
export const SOLANA_CLUSTER = WALLET_NETWORK_CONFIG.solana.devnet.networkId
export const SOLANA_NETWORK_NAME = WALLET_NETWORK_CONFIG.solana.devnet.name
/** Public Devnet JSON-RPC endpoint. Used by the server proxies when no ALCHEMY_API_KEY is configured. */
export const SOLANA_DEVNET_RPC_URL = WALLET_NETWORK_CONFIG.solana.devnet.publicRpcUrl
/**
 * RPC URL for server-side Solana reads. Always Devnet: Alchemy's Devnet host when a key is configured, otherwise the
 * public Devnet endpoint. There is no mainnet branch and no fallback to one.
 */
export function solanaDevnetRpcUrl(alchemyApiKey?: string): string {
  return alchemyApiKey ? `${WALLET_NETWORK_CONFIG.solana.devnet.alchemyHost}/${encodeURIComponent(alchemyApiKey)}` : SOLANA_DEVNET_RPC_URL
}
/** Genesis hash of Solana Devnet; a server can compare it with `getGenesisHash` to prove which cluster answered. */
export const SOLANA_DEVNET_GENESIS_HASH = WALLET_NETWORK_CONFIG.solana.devnet.genesisHash
export const SOLANA_EXPLORER_URL = WALLET_NETWORK_CONFIG.solana.devnet.explorerUrl

/** Faucets for getting free test tokens. Test tokens have no monetary value. */
export const SEPOLIA_FAUCET_HINT = 'Sepolia ETH is a free test token with no monetary value.'
export const SOLANA_FAUCET_HINT = WALLET_NETWORK_CONFIG.solana.devnet.faucetHint

/** Every EVM chain ID that is a live-money network NEXORA must refuse (informational: used to word errors). */
const KNOWN_EVM_MAINNETS: Readonly<Record<number, string>> = {
  1: 'Ethereum Mainnet', 10: 'Optimism', 56: 'BNB Chain', 137: 'Polygon', 8453: 'Base', 42161: 'Arbitrum One', 59144: 'Linea',
}

export function isSupportedEvmChain(chainId: unknown): chainId is typeof SEPOLIA_CHAIN_ID {
  return chainId === SEPOLIA_CHAIN_ID
}

export type NetworkGuard = { ok: true } | { ok: false; reason: string }

/** Describes an unsupported EVM chain for an error message, e.g. "Ethereum Mainnet (chain 1)". */
export function describeEvmChain(chainId: number | null): string {
  if (chainId === null) return 'an unknown network'
  const known = KNOWN_EVM_MAINNETS[chainId]
  return known ? `${known} (chain ${chainId})` : `chain ${chainId}`
}

/**
 * Must pass immediately before any EVM transaction is built or submitted, using the chain the wallet reports at that
 * moment. The native ETH send flow (lib/eth-transfer/gate.ts) and any future EVM send must call this first.
 */
export function guardEvmTransaction(activeChainId: number | null): NetworkGuard {
  if (activeChainId === null) return { ok: false, reason: 'Your wallet did not report its network. Switch to Sepolia and try again.' }
  if (!isSupportedEvmChain(activeChainId)) {
    return { ok: false, reason: `Your wallet is on ${describeEvmChain(activeChainId)}. NEXORA only works on Sepolia testnet (chain ${SEPOLIA_CHAIN_ID}). Switch to Sepolia to continue.` }
  }
  return { ok: true }
}

/** Throwing variant for code paths that cannot return a result. */
export function assertEvmTransactionAllowed(activeChainId: number | null): void {
  const guard = guardEvmTransaction(activeChainId)
  if ("reason" in guard) {
    throw new Error(guard.reason);
  }
}

/** True when the active Solana CAIP-2 chain (e.g. "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG") is Devnet. */
export function isSolanaDevnetCaip(caipNetworkId: unknown): boolean {
  return typeof caipNetworkId === 'string' && caipNetworkId === `solana:${SOLANA_DEVNET_GENESIS_HASH.slice(0, 32)}`
}

/** True when a Solana RPC endpoint URL is a known mainnet endpoint. Used to reject configuration, never to allow it. */
export function isSolanaMainnetUrl(url: string): boolean {
  return /mainnet/i.test(url)
}

/**
 * Must pass immediately before any Solana transaction is built or submitted. `activeCluster` is the cluster the wallet
 * connection reports ('devnet' | other string | null when unknown). The native SOL send flow (lib/solana-transfer/gate.ts) calls this first.
 */
export function guardSolanaTransaction(activeCluster: string | null): NetworkGuard {
  if (activeCluster === null) return { ok: false, reason: 'Your wallet did not report its Solana cluster. Switch to Devnet and try again.' }
  if (activeCluster !== SOLANA_CLUSTER) return { ok: false, reason: `Your wallet is on Solana ${activeCluster}. NEXORA only works on Solana Devnet. Switch to Devnet to continue.` }
  return { ok: true }
}

export function assertSolanaTransactionAllowed(activeCluster: string | null): void {
  const guard = guardSolanaTransaction(activeCluster)
  if ("reason" in guard) {
    throw new Error(guard.reason);
  }
}

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const SOLANA_SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/** Sepolia explorer links, or null for a malformed value. Built only from this fixed origin. */
export function sepoliaTxUrl(hash: string): string | null {
  return TX_HASH_RE.test(hash) ? `${SEPOLIA_EXPLORER_URL}/tx/${hash.toLowerCase()}` : null
}
export function sepoliaAddressUrl(address: string): string | null {
  return EVM_ADDRESS_RE.test(address) ? `${SEPOLIA_EXPLORER_URL}/address/${address.toLowerCase()}` : null
}

/** Solana Explorer links pinned to `?cluster=devnet`, or null for a malformed value. */
export function solanaDevnetTxUrl(signature: string): string | null {
  return SOLANA_SIGNATURE_RE.test(signature) ? `${SOLANA_EXPLORER_URL}/tx/${signature}?cluster=${SOLANA_CLUSTER}` : null
}
export function solanaDevnetAddressUrl(address: string): string | null {
  return SOLANA_ADDRESS_RE.test(address) ? `${SOLANA_EXPLORER_URL}/address/${address}?cluster=${SOLANA_CLUSTER}` : null
}
