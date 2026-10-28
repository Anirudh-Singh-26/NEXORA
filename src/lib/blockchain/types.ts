/** Shared types for the read-only blockchain data layer. No React, no browser-only globals. */

export type ChainId = number

export interface RpcEndpoint {
  /** Stable, non-secret identifier shown to users as the data source (never the URL: URLs can embed keys). */
  id: string
  url: string
  kind: 'configured' | 'public'
}

export interface ChainConfig {
  chainId: ChainId
  name: string
  shortName: string
  nativeSymbol: string
  nativeDecimals: number
  explorerUrl: string
  /** True for the networks Phase 2A is required to support; false for networks NEXORA already referenced elsewhere. */
  core: boolean
  /** Ordered by preference: a configured endpoint (if any) first, then public fallbacks. */
  endpoints: RpcEndpoint[]
}

export type BlockchainErrorKind =
  | 'unsupported-network'
  | 'invalid-input'
  | 'timeout'
  | 'rate-limited'
  | 'network'
  | 'http'
  | 'rpc'
  | 'malformed'
  | 'chain-mismatch'
  | 'cooldown'
  | 'aborted'

export interface ProviderAttempt {
  source: string
  kind: BlockchainErrorKind
  message: string
}

export interface BlockchainErrorInfo {
  kind: BlockchainErrorKind
  /** Short, user-safe message. Never contains URLs, keys or stack traces. */
  message: string
  /** True when trying again later may succeed. */
  retryable: boolean
  attempts: ProviderAttempt[]
}

/**
 * Where a value came from. `source` names one provider; values from different providers are never merged.
 * `endpointChainMatched` is true only when that provider's own eth_chainId matched the requested chain.
 * Nothing here asserts that the data is correct or authoritative: it is what a single public RPC returned.
 */
export interface Provenance {
  chainId: ChainId
  networkName: string
  source: string
  sourceKind: RpcEndpoint['kind']
  /** Epoch ms when the provider response was received (not when it was read from cache). */
  retrievedAt: number
  fromCache: boolean
  /** True when served past its freshness window because every provider failed. */
  stale: boolean
  ageMs: number
  endpointChainMatched: boolean
  /** Providers that failed before this one answered, in order. Empty when the first choice answered. */
  fallbackFrom: string[]
  /** Request duration in ms for a network fetch; null when served from cache. */
  latencyMs: number | null
}

export interface ChainSnapshot {
  chainId: ChainId
  blockNumber: number
  /** Decimal string, wei. */
  gasPriceWei: string
  /** Decimal string, gwei, truncated to 4 decimals. */
  gasPriceGwei: string
}

export interface NativeBalance {
  chainId: ChainId
  /** Lowercased 0x address that was queried. */
  address: string
  balanceWei: string
  /** Decimal string in native units, truncated (not rounded) to 6 decimals. */
  balanceFormatted: string
  symbol: string
}

export type ChainResult<T> =
  | {
      status: 'ok'
      data: T
      provenance: Provenance
      /** Set when stale data is shown because a refresh failed. */
      refreshError: BlockchainErrorInfo | null
    }
  | { status: 'unavailable'; error: BlockchainErrorInfo; chainId: ChainId | null }

export interface RequestOptions {
  signal?: AbortSignal
  /** Skip the freshness check (still deduplicated and rate-limited by a minimum refresh interval). */
  forceRefresh?: boolean
}
