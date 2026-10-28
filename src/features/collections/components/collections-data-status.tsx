import { COLLECTIONS_SOURCE } from '@/lib/nft-data/collections'
import type { LiveCollectionsSnapshot } from '@/lib/nft-data/types'

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

interface Props {
  mode: 'live' | 'demo'
  snapshot: LiveCollectionsSnapshot | null
  /** Refresh failure message while older live data is still shown. */
  error: string | null
  refreshing: boolean
  onRefresh: () => void
  onUseLive: () => void
}

/** One-line provenance strip: source, scope and timestamp when live; an explicit "demo" label otherwise. */
export function CollectionsDataStatus({ mode, snapshot, error, refreshing, onRefresh, onUseLive }: Props) {
  const btn = 'text-copper hover:underline disabled:opacity-60'
  const wrap = 'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute'
  if (mode === 'demo') {
    return (
      <div role="status" className={wrap}>
        <span className="font-medium text-ink">Demo data</span>
        <span>Illustrative collections and figures, not live market data.</span>
        <button type="button" onClick={onUseLive} className={btn}>Try live data</button>
      </div>
    )
  }
  if (!snapshot) return null
  return (
    <div role="status" className={wrap}>
      <span className="font-medium text-ink">Live collection data</span>
      <span>Top {snapshot.collections.length} by 24h volume · data from <a href={COLLECTIONS_SOURCE.url} target="_blank" rel="noopener noreferrer" className="text-copper hover:underline">{COLLECTIONS_SOURCE.name}</a></span>
      <span>Updated {time(snapshot.fetchedAt)}</span>
      <button type="button" onClick={onRefresh} disabled={refreshing} className={btn}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
      {snapshot.partial ? <span>Some statistics were unavailable and show “—”.</span> : null}
      {error ? <span className="text-loss">Refresh failed — showing earlier data. {error}</span> : null}
    </div>
  )
}
