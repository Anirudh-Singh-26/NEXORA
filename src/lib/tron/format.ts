/** TRX/SUN conversion and TRON address display helpers. Pure; no floating point is used for money. */

export const SUN_PER_TRX = 1_000_000n
const TRX_DECIMALS = 6

/**
 * Format an amount of SUN as an exact TRX decimal string (1 TRX = 1,000,000 SUN).
 * Trailing zeros of the fraction are trimmed (keeping at least `minFraction` digits);
 * the integer part gets thousands separators.
 */
export function formatSunAsTrx(sun: bigint, minFraction = 0): string {
  if (sun < 0n) throw new RangeError('SUN amount cannot be negative')
  const whole = sun / SUN_PER_TRX
  const fraction = (sun % SUN_PER_TRX).toString().padStart(TRX_DECIMALS, '0').replace(/0+$/, '')
  const padded = fraction.padEnd(Math.min(Math.max(minFraction, 0), TRX_DECIMALS), '0')
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return padded ? `${wholeText}.${padded}` : wholeText
}

/** Parse a JSON balance that must be a non-negative integer number of SUN. Returns null when it is not. */
export function parseSun(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value >= 0n ? value : null
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) return null
    return BigInt(value)
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value)
  return null
}

/**
 * Format-only check for a base58 TRON address (starts with "T", 34 characters, base58 alphabet).
 * This does not verify the checksum; the wallet supplies the address and the RPC validates it.
 */
export function looksLikeTronAddress(value: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)
}

export function shortenTronAddress(address: string, head = 6, tail = 6): string {
  if (address.length <= head + tail + 1) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}
