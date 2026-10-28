import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/shared/empty-state'
import { TableSkeleton } from '@/components/shared/loading-state'
import { catalog } from '@/data/catalog'
import { filterTokens, type TokenSort } from '@/data/selectors'
import type { NetworkId } from '@/data/types'
import { useLiveTokens } from '@/hooks/use-live-tokens'
import { MarketOverview } from '@/features/tokens/components/market-overview'
import { computePulse } from '@/features/tokens/market-pulse'
import { MarketDataStatus } from '@/features/tokens/components/market-data-status'
import { TokenControls, type Direction, type TokenView } from '@/features/tokens/components/token-controls'
import { TokenHeader, ZoneLabel } from '@/features/tokens/components/token-header'
import { TokenHeatmap } from '@/features/tokens/components/token-heatmap'
import { TokenTable } from '@/features/tokens/components/token-table'
import { useWatchlistStore } from '@/store/watchlist-store'
import './tokens-page.css'

/** Name sorts A→Z by default; every numeric key sorts high→low. */
const defaultAscending = (key: TokenSort) => key === 'name'

/**
 * Tokens: a market terminal. Market-wide instruments (strip, movers,
 * distribution, network share) sit above a dense, sortable directory.
 * Figures are live CoinGecko quotes. The illustrative catalogue is only shown
 * when the user explicitly switches to the clearly labelled demo view.
 */
export function TokensPage() {
  const live = useLiveTokens()
  const [useDemo, setUseDemo] = useState(false)
  const mode = useDemo ? 'demo' : 'live'
  const source = useDemo ? catalog.tokens : live.tokens
  const loading = !useDemo && live.status === 'loading'
  const failed = !useDemo && live.status === 'error'

  const watchedIds = useWatchlistStore((s) => s.tokenIds)
  const [query, setQuery] = useState('')
  const [network, setNetwork] = useState<NetworkId | 'all'>('all')
  const [sort, setSort] = useState<TokenSort>('marketCap')
  const [flipped, setFlipped] = useState(false)
  const [direction, setDirection] = useState<Direction>('all')
  const [watchedOnly, setWatchedOnly] = useState(false)
  const [view, setView] = useState<TokenView>('table')

  const sorted = useMemo(() => {
    const base = filterTokens({ query, network, sort, tokens: source })
    const scoped = watchedOnly ? base.filter((t) => watchedIds.includes(t.id)) : base
    return flipped ? [...scoped].reverse() : scoped
  }, [source, query, network, sort, flipped, watchedOnly, watchedIds])

  const rows = useMemo(
    () => (direction === 'all' ? sorted : sorted.filter((t) => (direction === 'up' ? t.change24h >= 0 : t.change24h < 0))),
    [sorted, direction],
  )
  const counts = useMemo(
    () => ({ all: sorted.length, up: sorted.filter((t) => t.change24h >= 0).length, down: sorted.filter((t) => t.change24h < 0).length }),
    [sorted],
  )

  const pulse = useMemo(() => (source.length > 0 ? computePulse(source, catalog.networks) : null), [source])

  const hasFilters = Boolean(query.trim()) || network !== 'all' || direction !== 'all' || watchedOnly
  const reset = () => { setQuery(''); setNetwork('all'); setDirection('all'); setSort('marketCap'); setFlipped(false); setWatchedOnly(false) }

  const pickSort = (key: TokenSort) => {
    if (key === sort) setFlipped((f) => !f)
    else { setSort(key); setFlipped(false) }
  }
  const ascending = defaultAscending(sort) !== flipped

  const status = (
    <MarketDataStatus
      mode={mode} snapshot={live.snapshot} excluded={live.excluded}
      error={live.status === 'ready' ? live.error : null} refreshing={live.refreshing}
      onRefresh={live.retry} onUseLive={() => setUseDemo(false)}
    />
  )

  if (loading) {
    return (
      <div className="nxt-page">
        <ZoneLabel title="Market overview" hint="Loading live market data…" />
        <TableSkeleton />
      </div>
    )
  }

  if (failed || !pulse) {
    return (
      <div className="nxt-page">
        <EmptyState
          title="Live market data unavailable"
          body={live.error ?? 'No token data could be loaded.'}
          action={(
            <span className="flex items-center gap-4">
              <button type="button" onClick={live.retry} disabled={live.refreshing} className="text-sm text-copper hover:underline disabled:opacity-60">
                {live.refreshing ? 'Retrying…' : 'Retry'}
              </button>
              <button type="button" onClick={() => setUseDemo(true)} className="text-sm text-mute hover:underline">View demo data</button>
            </span>
          )}
        />
      </div>
    )
  }

  return (
    <div className="nxt-page">
      <TokenHeader tokens={source} pulse={pulse} />

      {status}

      <ZoneLabel title="Market overview" hint={useDemo ? 'Demo catalogue · illustrative' : 'Live quotes · 24h'} />
      <MarketOverview pulse={pulse} network={network} onNetwork={setNetwork} />

      <ZoneLabel title="Token directory" hint="Rank, filter and compare" />

      <TokenControls
        query={query} onQuery={setQuery}
        network={network} onNetwork={setNetwork} networks={catalog.networks}
        sort={sort} onSort={(v) => { setSort(v); setFlipped(false) }}
        ascending={ascending} onFlip={() => setFlipped((f) => !f)}
        direction={direction} onDirection={setDirection} counts={counts}
        watchedOnly={watchedOnly} onWatchedOnly={() => setWatchedOnly((v) => !v)} watchedCount={watchedIds.length}
        view={view} onView={setView}
        shown={rows.length} total={pulse.total} hasFilters={hasFilters} onReset={reset}
      />

      {rows.length === 0 ? (
        <EmptyState
          title={watchedOnly && watchedIds.length === 0 ? 'Your watchlist has no tokens' : 'No tokens match'}
          body={watchedOnly && watchedIds.length === 0 ? 'Bookmark a token from the ranking to follow it here.' : `Clear filters to return to the full ${useDemo ? 'demo' : 'live'} ranking.`}
          action={<button type="button" onClick={reset} className="text-sm text-copper hover:underline">Clear filters</button>}
        />
      ) : view === 'heat' ? (
        <TokenHeatmap rows={rows} />
      ) : (
        <TokenTable rows={rows} totalCap={pulse.totalCap} sort={sort} ascending={ascending} onSort={pickSort} />
      )}
    </div>
  )
}
