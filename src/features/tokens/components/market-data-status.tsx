import type { Token } from '@/data/types'
import { MARKET_SOURCE, type MarketSnapshot } from '@/lib/market-data/coingecko'

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

interface Props {
  mode: 'live' | 'demo'
  snapshot: MarketSnapshot | null
  /** Catalogue tokens left out of the live ranking because they have no live quote. */
  excluded: Token[]
  /** Refresh failure message while older live data is still shown. */
  error: string | null
  refreshing: boolean
  onRefresh: () => void
  onUseLive: () => void
}

/** One-line provenance strip: source attribution + timestamp when live; an explicit "demo" label otherwise. */
export function MarketDataStatus({ mode, snapshot, excluded, error, refreshing, onRefresh, onUseLive }: Props) {
  const btn = 'text-copper hover:underline disabled:opacity-60'
  if (mode === 'demo') {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
        <span className="font-medium text-ink">Demo data</span>
        <span>Illustrative figures, not live prices.</span>
        <button type="button" onClick={onUseLive} className={btn}>Try live data</button>
      </div>
    )
  }
  if (!snapshot) return null
  const providerTimes = Object.values(snapshot.quotes).map((q) => q.providerUpdatedAt).filter((v): v is number => v !== null)
  const newest = providerTimes.length ? Math.max(...providerTimes) : null
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
      <span className="font-medium text-ink">Live market data</span>
      <span>
        Data provided by{' '}
        <a href={MARKET_SOURCE.url} target="_blank" rel="noreferrer" className="text-copper hover:underline">{MARKET_SOURCE.name}</a>
      </span>
      <span title={newest ? `Newest provider quote: ${time(newest)}` : undefined}>Updated {time(snapshot.fetchedAt)}</span>
      <button type="button" onClick={onRefresh} disabled={refreshing} className={btn}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
      {error && <span className="text-loss">Refresh failed — showing earlier data. {error}</span>}
      {excluded.length > 0 && (
        <span>No live quote for {excluded.map((t) => t.ticker).join(', ')}; not shown.</span>
      )}
    </div>
  )
}
