/**
 * Solana account helpers that keep the Solana ecosystem strictly separate from EVM. Pure (no React/AppKit) for unit tests.
 */
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/** A Solana public key is base58 (32–44 chars). An EVM `0x…` address can never match, so it cannot pass as a Solana account. */
export function isSolanaAddress(value: unknown): value is string {
  return typeof value === 'string' && SOLANA_ADDRESS.test(value)
}

/** Genesis-hash prefixes of AppKit's Solana CAIP-2 network ids, mapped to the names AppKit itself uses for them. */
const SOLANA_CLUSTER_NAMES: Readonly<Record<string, string>> = {
  '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'Solana',
  EtWTRABZaYq6iMfeYKouRu166VU2xqa1: 'Solana Devnet',
  '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z': 'Solana Testnet',
}

/**
 * The cluster of the Solana ACCOUNT, read from its own CAIP address (`solana:<genesis>:<address>`), never from whichever
 * chain AppKit currently has active. Returns null for anything that is not a recognised Solana cluster, so the network
 * stays "unverified" instead of being guessed.
 */
export function solanaClusterName(caipAddress: unknown): string | null {
  if (typeof caipAddress !== 'string') return null
  const [namespace, reference] = caipAddress.split(':')
  if (namespace !== 'solana' || !reference) return null
  return SOLANA_CLUSTER_NAMES[reference] ?? null
}
