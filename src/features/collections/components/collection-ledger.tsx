import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { NetworkChip } from '@/components/shared/network-chip'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import type { CollectionSort } from '@/data/selectors'
import { Byline, CollectionArt, CollectionLink } from '@/features/collections/components/collection-parts'
import { fmtCount, fmtFloor, fmtVolume } from '@/lib/nft-data/format'
import type { ListedCollection } from '@/lib/nft-data/types'
import { cn } from '@/lib/utils'

/** List view: a ranked leaderboard with a volume bar per row. */
export function CollectionLedger({ rows, sort, onSort }: { rows: ListedCollection[]; sort: CollectionSort; onSort: (key: CollectionSort) => void }) {
  // Volumes are in each chain's own currency, so bars only compare rows that share a unit.
  const maxVolume = new Map<string, number>()
  for (const c of rows) if (c.volume24h) maxVolume.set(c.volume24h.symbol, Math.max(maxVolume.get(c.volume24h.symbol) ?? 0, c.volume24h.value))
  const head = (label: string, key: CollectionSort, className?: string) => (
    <button type="button" onClick={() => onSort(key)} aria-pressed={sort === key} className={cn('nx-eyebrow nxc-ledger__sort', sort === key && 'is-active', className)}>
      {label}
      {sort === key ? <ArrowDown className="size-3" /> : null}
    </button>
  )
  return (
    <div className="nxc-ledger">
      <div className="nxc-ledger__row nxc-ledger__row--head">
        <span className="nx-eyebrow">#</span>
        {head('Collection', 'name')}
        <span className="nx-eyebrow nxc-hide-sm">Network</span>
        {head('Floor', 'floor')}
        {head('24h volume', 'volume', 'nxc-hide-sm')}
        {head('Items', 'items', 'nxc-hide-md')}
        <span className="nx-eyebrow nxc-hide-md">Owners</span>
        <span />
      </div>
      {rows.map((c, index) => (
        <div key={c.id} className="nxc-ledger__row">
          <span className="nxc-ledger__rank">{String(index + 1).padStart(2, '0')}</span>
          <CollectionLink collection={c} className="nxc-ledger__who">
            <CollectionArt src={c.cover} alt="" fallbackLabel={c.name.slice(0, 2)} shade="none" parallax={false} sheen={false} className="nxc-ledger__thumb" />
            <span className="min-w-0">
              <b>{c.name}</b>
              <small><Byline collection={c} /></small>
            </span>
          </CollectionLink>
          <span className="nxc-hide-sm"><NetworkChip id={c.networkId} /></span>
          <span className="nxc-num">{fmtFloor(c.floor)}</span>
          <span className="nxc-hide-sm nxc-volcell">
            <span className="nxc-num">{fmtVolume(c.volume24h)}</span>
            {c.volume24h && (maxVolume.get(c.volume24h.symbol) ?? 0) > 0 ? (
              <span aria-hidden className="nxc-volbar"><i style={{ width: `${Math.max((c.volume24h.value / (maxVolume.get(c.volume24h.symbol) ?? 1)) * 100, 3)}%` }} /></span>
            ) : null}
          </span>
          <span className="nxc-num nxc-hide-md">{fmtCount(c.items)}</span>
          <span className="nxc-num nxc-hide-md">{fmtCount(c.owners)}</span>
          <span className="nxc-ledger__actions">
            {c.source === 'demo' ? <WatchlistButton kind="collection" id={c.id} compact /> : null}
            <CollectionLink collection={c} aria-label={`Open ${c.name}`} className="nxc-ledger__open"><ArrowUpRight className="size-3.5" /></CollectionLink>
          </span>
        </div>
      ))}
    </div>
  )
}
