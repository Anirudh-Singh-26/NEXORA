import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Coins, Gem, Layers, Rocket } from 'lucide-react'
import { getNetwork } from '@/data/selectors'
import type { NetworkId } from '@/data/types'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { KIND_ORDER, KIND_LABEL, type WatchKind, type WatchRow } from '@/features/watchlist/watchlist-model'

const KIND_ICON: Record<WatchKind, React.ReactNode> = { token: <Coins />, collection: <Layers />, asset: <Gem />, campaign: <Rocket /> }

/**
 * Overview band: per-type counts (which also filter the table), a read on the
 * tracked tokens' 24h moves, and how tracked items spread across networks.
 * Nothing here is a portfolio value: it only counts and averages catalogue data.
 */
export function WatchOverview({
  rows, kind, onKind, network, onNetwork,
}: {
  rows: WatchRow[]
  kind: WatchKind | 'all'
  onKind: (value: WatchKind | 'all') => void
  network: NetworkId | 'all'
  onNetwork: (value: NetworkId | 'all') => void
}) {
  const stats = useMemo(() => {
    const counts = Object.fromEntries(KIND_ORDER.map((k) => [k, rows.filter((r) => r.kind === k).length])) as Record<WatchKind, number>
    const movers = rows.filter((r): r is WatchRow & { change: number } => r.change !== undefined)
    const sorted = [...movers].sort((a, b) => b.change - a.change)
    const spread = new Map<NetworkId, number>()
    for (const r of rows) if (r.networkId) spread.set(r.networkId, (spread.get(r.networkId) ?? 0) + 1)
    const nets = [...spread.entries()].map(([id, count]) => ({ network: getNetwork(id), count })).filter((n) => n.network).sort((a, b) => b.count - a.count)
    return {
      counts,
      avg: movers.length ? movers.reduce((s, r) => s + r.change, 0) / movers.length : null,
      up: movers.filter((r) => r.change >= 0).length,
      down: movers.filter((r) => r.change < 0).length,
      best: sorted[0],
      worst: sorted.length > 1 ? sorted[sorted.length - 1] : undefined,
      live: rows.filter((r) => r.status === 'live').length,
      nets,
      tracked: rows.filter((r) => r.networkId).length,
    }
  }, [rows])

  return (
    <section className="nxw-over" aria-label="Watchlist overview">
      <dl className="nxw-kinds">
        {KIND_ORDER.map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => onKind(kind === k ? 'all' : k)} className={cn('nxw-kind', `is-${k}`)}>
            <span className="nxw-kind__icon">{KIND_ICON[k]}</span>
            <dd>{String(stats.counts[k]).padStart(2, '0')}</dd>
            <dt>{KIND_LABEL[k]}s</dt>
          </button>
        ))}
      </dl>

      <div className="nxw-pulse">
        <div className="nxw-pulse__col">
          <p className="nxw-label">Tracked tokens, 24h</p>
          {stats.avg === null ? (
            <p className="nxw-pulse__none">Save a token to see its movement here.</p>
          ) : (
            <>
              <p className={cn('nxw-pulse__big', stats.avg >= 0 ? 'is-up' : 'is-down')}>
                {stats.avg >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}{formatPercent(stats.avg)}
                <small>average</small>
              </p>
              <p className="nxw-pulse__line">
                <span className="is-up">{stats.up} up</span> · <span className="is-down">{stats.down} down</span>
                {stats.best ? <> · Best <Link to={stats.best.href} className="nxw-link">{stats.best.sub}</Link> <span className="is-up">{formatPercent(stats.best.change)}</span></> : null}
                {stats.worst ? <> · Weakest <Link to={stats.worst.href} className="nxw-link">{stats.worst.sub}</Link> <span className={stats.worst.change >= 0 ? 'is-up' : 'is-down'}>{formatPercent(stats.worst.change)}</span></> : null}
              </p>
            </>
          )}
          {stats.live > 0 ? <p className="nxw-pulse__live"><span className="nx-live-dot" /> {stats.live} saved {stats.live === 1 ? 'campaign is' : 'campaigns are'} live</p> : null}
        </div>

        <div className="nxw-pulse__col">
          <p className="nxw-label">Network spread <em>click to filter</em></p>
          {stats.nets.length === 0 ? (
            <p className="nxw-pulse__none">No saved items yet.</p>
          ) : (
            <>
              <div className="nxw-spread" role="img" aria-label={`Saved items by network: ${stats.nets.map((n) => `${n.network?.name} ${n.count}`).join(', ')}`}>
                {stats.nets.map((n) => <i key={n.network!.id} style={{ flexGrow: n.count, background: n.network!.color }} />)}
              </div>
              <ul className="nxw-legend">
                {stats.nets.map((n) => {
                  const active = network === n.network!.id
                  return (
                    <li key={n.network!.id}>
                      <button type="button" aria-pressed={active} onClick={() => onNetwork(active ? 'all' : n.network!.id)} className={cn('nxw-legend__item', active && 'is-active')}>
                        <i style={{ background: n.network!.color }} />{n.network!.shortName}<b>{n.count}</b>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
