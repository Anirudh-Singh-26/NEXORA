/** Shapes shared by the activity proxies (api/wallet-activity.ts, api/solana-activity.ts) and the browser clients. */

export type TransferCategory = 'external' | 'erc20' | 'erc721' | 'erc1155'

/** One on-chain transfer event inside a transaction. */
export interface EvmTransfer {
  category: TransferCategory
  from: string | null
  to: string | null
  /** Asset symbol as reported by the provider (e.g. "ETH", "USDC"); null when unknown. */
  asset: string | null
  /** Decimal amount string (exact when raw value + decimals were available), null when the provider gave none (e.g. NFTs). */
  amount: string | null
  /** Token / NFT contract (lowercase) for non-native transfers. */
  contract: string | null
  /** NFT token id (decimal string) for erc721 / erc1155 transfers. */
  tokenId: string | null
}

/** One transaction (grouped by hash) with every transfer event the provider returned for it. */
export interface EvmActivityItem {
  hash: string
  blockNumber: number
  /** ISO-8601 timestamp, or null when the provider did not supply block metadata. */
  timestamp: string | null
  transfers: EvmTransfer[]
}

export interface EvmActivityPage {
  chainId: number
  address: string
  items: EvmActivityItem[]
  /** Opaque cursor for the next (older) page, or null when history is exhausted. */
  nextCursor: string | null
}

/**
 * What NEXORA could derive about one Solana Devnet transaction from `getTransaction`, relative to the connected wallet.
 * `null` on the item means the details could not be read (rate limit, not yet available, pruned): the row then shows
 * only what `getSignaturesForAddress` reported and says the details are unavailable.
 */
export interface SolanaTxDetails {
  /** 'transfer': every instruction is a System Program transfer (compute-budget instructions ignored). 'other': anything else. */
  kind: 'transfer' | 'other'
  /** Relative to the wallet. 'other' means the wallet is neither the sender nor the receiver of a plain transfer. */
  direction: 'sent' | 'received' | 'self' | 'other'
  /** The single other party of a plain transfer; null when there are several or it is not a plain transfer. */
  counterparty: string | null
  /** Exact SOL moved in lamports (integer string) for a successful plain transfer; null otherwise. */
  lamports: string | null
  /** The wallet's own balance change in lamports (signed integer string, includes the fee when it paid it); null when unknown. */
  netChangeLamports: string | null
  /** Fee in lamports when the wallet paid it (fee payer); null otherwise. */
  feeLamports: string | null
}

export interface SolanaActivityItem {
  signature: string
  slot: number
  /** Unix seconds from the provider, or null when unavailable. */
  blockTime: number | null
  /** 'success' / 'failed' from the transaction error field; null when it was not reported. */
  status: 'success' | 'failed' | null
  /** getSignaturesForAddress only reports 'confirmed' or 'finalized'; 'processed' is accepted if a provider returns it. */
  confirmation: 'processed' | 'confirmed' | 'finalized' | null
  /** Derived amount/direction details, or null when they could not be read for this transaction. */
  details: SolanaTxDetails | null
}

export interface SolanaActivityPage {
  /** Always 'devnet': the proxy refuses to answer from anywhere else. */
  cluster: 'devnet'
  address: string
  items: SolanaActivityItem[]
  nextCursor: string | null
}
