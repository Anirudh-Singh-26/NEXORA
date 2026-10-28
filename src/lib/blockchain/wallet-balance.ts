import { normalizeAddress } from './normalize.ts'
import type { ChainConfig, ChainId } from './types.ts'

/**
 * Pure decision: can a native balance be read for the wallet's current account/chain, and if not, why not.
 * No React, no network. `chains` is the data layer's chain list (blockchain.listChains()).
 */
export type BalanceTarget =
  | { kind: 'no-wallet' }
  | { kind: 'invalid-address' }
  | { kind: 'unknown-network' }
  | { kind: 'unsupported-network'; chainId: ChainId }
  | { kind: 'ready'; chainId: ChainId; address: string; chain: ChainConfig }

export function resolveBalanceTarget(address: string | null, chainId: ChainId | null, chains: readonly ChainConfig[]): BalanceTarget {
  if (!address) return { kind: 'no-wallet' }
  const normalized = normalizeAddress(address)
  if (!normalized) return { kind: 'invalid-address' }
  if (chainId === null) return { kind: 'unknown-network' }
  const chain = chains.find((item) => item.chainId === chainId)
  if (!chain) return { kind: 'unsupported-network', chainId }
  return { kind: 'ready', chainId, address: normalized, chain }
}

/** Adds thousands separators to the whole part of a decimal string; the fractional part is kept verbatim (no rounding). */
export function groupDecimal(value: string): string {
  const [whole, fraction] = value.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}
