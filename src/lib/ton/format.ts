/** 1 TON = 1,000,000,000 nanoTON. All monetary values are bigint nanoTON; floating point is never used. */
export const NANO_PER_TON = 1_000_000_000n
const FRACTION_DIGITS = 9
const MAX_DIGITS = 30

/**
 * Parses a nanoTON amount from an API response. Accepts a string of decimal digits (TON Center returns
 * balances as strings) or a non-negative safe integer. Everything else (negative, fractional, exponent,
 * whitespace, empty, NaN, unsafe numbers, other types) returns null.
 */
export function parseNanoTon(raw: unknown): bigint | null {
  if (typeof raw === 'string') {
    if (!/^\d+$/.test(raw) || raw.length > MAX_DIGITS) return null
    return BigInt(raw)
  }
  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw < 0) return null
    return BigInt(raw)
  }
  return null
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Integer nanoTON with thousands separators, e.g. 1234567890 -> "1,234,567,890". */
export function formatNanoTonUnits(nano: bigint): string {
  if (nano < 0n) throw new RangeError('nanoTON amount must not be negative')
  return groupThousands(nano.toString())
}

/**
 * Exact TON amount from nanoTON using integer arithmetic only. Never rounds: trailing zeros are trimmed down to
 * `minFractionDigits` (default 2), so 1_500_000_000n -> "1.50" and 1_234_567_891n -> "1.234567891".
 */
export function formatNanoTon(nano: bigint, minFractionDigits = 2): string {
  if (nano < 0n) throw new RangeError('nanoTON amount must not be negative')
  const min = Math.min(Math.max(Math.trunc(minFractionDigits), 0), FRACTION_DIGITS)
  const whole = groupThousands((nano / NANO_PER_TON).toString())
  const fraction = (nano % NANO_PER_TON).toString().padStart(FRACTION_DIGITS, '0')
  let trimmed = fraction.replace(/0+$/, '')
  if (trimmed.length < min) trimmed = fraction.slice(0, min)
  return trimmed === '' ? whole : `${whole}.${trimmed}`
}
