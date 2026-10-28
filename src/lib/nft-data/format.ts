import { formatCompact, formatFloor } from '../format.ts'
import type { Amount } from './types.ts'

/** Shown wherever the provider supplied no value. Never a zero. */
export const NO_VALUE = '—'

export const fmtFloor = (a: Amount | null) => (a ? formatFloor(a.value, a.symbol) : NO_VALUE)
export const fmtVolume = (a: Amount | null) => (a ? `${formatCompact(a.value)}${a.symbol ? ` ${a.symbol}` : ''}` : NO_VALUE)
export const fmtCount = (n: number | null) => (n === null ? NO_VALUE : formatCompact(n))
