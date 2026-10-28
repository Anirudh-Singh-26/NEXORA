import { BlockchainError } from './errors.ts'
import type { ChainId, ChainSnapshot, NativeBalance } from './types.ts'

const QUANTITY = /^0x(0|[1-9a-fA-F][0-9a-fA-F]*)$/
const ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** Parses a JSON-RPC QUANTITY (0x-prefixed hex, no leading zeros). Anything else is malformed. */
export function parseQuantity(value: unknown): bigint {
  if (typeof value !== 'string' || !QUANTITY.test(value)) {
    throw new BlockchainError('malformed', 'The network provider returned an unreadable response.')
  }
  return BigInt(value)
}

/** Formats an integer amount as a decimal string, truncating (never rounding) to maxFraction digits. */
export function formatUnits(value: bigint, decimals: number, maxFraction: number): string {
  const base = 10n ** BigInt(decimals)
  const whole = value / base
  const fraction = (value % base).toString().padStart(decimals, '0').slice(0, maxFraction).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

/** Returns the lowercased address, or null when it is not a well-formed 20-byte hex address. */
export function normalizeAddress(input: unknown): string | null {
  return typeof input === 'string' && ADDRESS.test(input.trim()) ? input.trim().toLowerCase() : null
}

export function normalizeSnapshot(chainId: ChainId, blockNumberHex: unknown, gasPriceHex: unknown): ChainSnapshot {
  const block = parseQuantity(blockNumberHex)
  const gasPrice = parseQuantity(gasPriceHex)
  if (block > BigInt(Number.MAX_SAFE_INTEGER)) throw new BlockchainError('malformed', 'The network provider returned an unreadable response.')
  return { chainId, blockNumber: Number(block), gasPriceWei: gasPrice.toString(), gasPriceGwei: formatUnits(gasPrice, 9, 4) }
}

export function normalizeBalance(chainId: ChainId, address: string, balanceHex: unknown, decimals: number, symbol: string): NativeBalance {
  const balance = parseQuantity(balanceHex)
  return { chainId, address, balanceWei: balance.toString(), balanceFormatted: formatUnits(balance, decimals, 6), symbol }
}
