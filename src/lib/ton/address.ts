import { WALLET_NETWORK_CONFIG } from '../wallet/network-config.ts'
/**
 * TON Connect reports `account.address` in raw form: `<workchain>:<64 hex characters>`.
 * Only the basechain (0) and masterchain (-1) workchains are accepted.
 */
const RAW_ADDRESS = /^(?:0|-1):[0-9a-fA-F]{64}$/

export function isRawTonAddress(value: unknown): value is string {
  return typeof value === 'string' && RAW_ADDRESS.test(value)
}

/** Shortens any address string for display: `head…tail`. Short strings are returned unchanged. */
export function shortenTonAddress(address: string, head = 6, tail = 6): string {
  if (address.length <= head + tail + 1) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

/** Testnet explorer link for an address (raw or user-friendly). Only ever shown for a positively identified testnet wallet. */
export function tonTestnetAddressUrl(address: string): string {
  return `${WALLET_NETWORK_CONFIG.ton.testnet.transactionExplorerUrl}/${encodeURIComponent(address)}`
}
