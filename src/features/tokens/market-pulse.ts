import type { Network, Token } from '@/data/types'

export type MarketPulse = {
  totalCap: number
  totalVol: number
  weighted: number
  up: number
  down: number
  total: number
  gainers: Token[]
  losers: Token[]
  nets: { network: Network; cap: number; count: number }[]
  buckets: { label: string; count: number; tone: 'up' | 'down' }[]
}

export const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '< −8', min: -Infinity, max: -8 },
  { label: '−8…−4', min: -8, max: -4 },
  { label: '−4…−2', min: -4, max: -2 },
  { label: '−2…0', min: -2, max: 0 },
  { label: '0…2', min: 0, max: 2 },
  { label: '2…4', min: 2, max: 4 },
  { label: '4…8', min: 4, max: 8 },
  { label: '> 8', min: 8, max: Infinity },
]

/** Whole-catalogue statistics. Independent of the directory filters. */
export function computePulse(tokens: Token[], networks: Network[]): MarketPulse {
  const totalCap = tokens.reduce((s, t) => s + t.marketCap, 0)
  const totalVol = tokens.reduce((s, t) => s + t.volume24h, 0)
  const byChange = [...tokens].sort((a, b) => b.change24h - a.change24h)
  const up = tokens.filter((t) => t.change24h >= 0).length
  return {
    totalCap,
    totalVol,
    weighted: totalCap ? tokens.reduce((s, t) => s + t.change24h * t.marketCap, 0) / totalCap : 0,
    up,
    down: tokens.length - up,
    total: tokens.length,
    gainers: byChange.filter((t) => t.change24h >= 0).slice(0, 4),
    losers: [...byChange].reverse().filter((t) => t.change24h < 0).slice(0, 4),
    nets: networks
      .map((n) => {
        const own = tokens.filter((t) => t.networkId === n.id)
        return { network: n, cap: own.reduce((s, t) => s + t.marketCap, 0), count: own.length }
      })
      .filter((n) => n.cap > 0)
      .sort((a, b) => b.cap - a.cap),
    buckets: BUCKETS.map((b) => ({
      label: b.label,
      count: tokens.filter((t) => t.change24h >= b.min && t.change24h < b.max).length,
      tone: b.max <= 0 ? 'down' : 'up',
    })),
  }
}
