export const RHYTHM_DAYS = 14
export const DAY_MS = 86_400_000

/** "5m ago", "3h ago", "4d ago", then a short date. Purely presentational. */
export function agoLabel(timestamp: string | null, now: number = Date.now()): string {
  if (!timestamp) return 'Time unavailable'
  const then = new Date(timestamp).getTime()
  if (Number.isNaN(then)) return 'Time unavailable'
  const diff = Math.max(0, now - then)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Counts loaded transactions per local calendar day for the last `days` days (oldest first). Only real timestamps count. */
export function dailyCounts(timestamps: ReadonlyArray<string | null>, now: number = Date.now(), days: number = RHYTHM_DAYS): Array<{ start: number; count: number }> {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const end = today.getTime() + DAY_MS
  const buckets = Array.from({ length: days }, (_, index) => ({ start: end - (days - index) * DAY_MS, count: 0 }))
  for (const stamp of timestamps) {
    if (!stamp) continue
    const time = new Date(stamp).getTime()
    if (Number.isNaN(time) || time >= end) continue
    const index = Math.floor((time - (end - days * DAY_MS)) / DAY_MS)
    if (index >= 0 && index < days) buckets[index].count += 1
  }
  return buckets
}
