import { shortOwner } from '@/lib/nft-data/collections'

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "5 minutes ago" style label; null/invalid → "—". */
export function timeAgo(ms: number | null, now = Date.now()): string {
  if (ms === null) return '—'
  const diff = Math.round((ms - now) / 1000)
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(diff, 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86_400), 'day')
}

export const fullDate = (ms: number | null) => (ms === null ? undefined : new Date(ms).toLocaleString())
export const shortAddress = (a: string | null) => (a ? shortOwner(a) : '—')
