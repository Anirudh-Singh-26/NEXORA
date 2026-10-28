import { ArrowDown, ArrowUp, Bookmark, LayoutGrid, RotateCcw, Rows3, Search, X } from 'lucide-react'
import { Segmented } from '@/components/shared/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TokenSort } from '@/data/selectors'
import type { Network, NetworkId } from '@/data/types'
import { cn } from '@/lib/utils'

export type Direction = 'all' | 'up' | 'down'
export type TokenView = 'table' | 'heat'

/** Command bar above the directory: query, scope, order, layout. */
export function TokenControls(props: {
  query: string; onQuery: (v: string) => void
  network: NetworkId | 'all'; onNetwork: (v: NetworkId | 'all') => void; networks: Network[]
  sort: TokenSort; onSort: (v: TokenSort) => void
  ascending: boolean; onFlip: () => void
  direction: Direction; onDirection: (v: Direction) => void; counts: { all: number; up: number; down: number }
  watchedOnly: boolean; onWatchedOnly: () => void; watchedCount: number
  view: TokenView; onView: (v: TokenView) => void
  shown: number; total: number; hasFilters: boolean; onReset: () => void
}) {
  return (
    <section className="nxt-controls nx-sticky-bar" aria-label="Token directory controls">
      <div className="nxt-controls__row">
        <label className="nx-field nxt-search">
          <Search className="pointer-events-none absolute left-3 size-4 text-mute" />
          <input value={props.query} onChange={(e) => props.onQuery(e.target.value)} placeholder="Search ticker or name" aria-label="Search ticker or name" />
          {props.query ? (
            <button type="button" onClick={() => props.onQuery('')} aria-label="Clear search" className="absolute right-2 rounded p-1 text-mute hover:text-ink"><X className="size-3.5" /></button>
          ) : null}
        </label>
        <div className="nxt-controls__selects">
          <Select value={props.network} onValueChange={(v) => props.onNetwork(v as NetworkId | 'all')}>
            <SelectTrigger className="h-9" aria-label="Network"><SelectValue placeholder="Network" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All networks</SelectItem>
              {props.networks.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={props.sort} onValueChange={(v) => props.onSort(v as TokenSort)}>
            <SelectTrigger className="h-9" aria-label="Sort by"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="marketCap">Market cap</SelectItem>
              <SelectItem value="volume">Volume</SelectItem>
              <SelectItem value="change">24h change</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Segmented<Direction>
          label="24h direction"
          value={props.direction}
          onChange={props.onDirection}
          options={[
            { value: 'all', label: 'All', count: props.counts.all },
            { value: 'up', label: 'Gainers', count: props.counts.up },
            { value: 'down', label: 'Losers', count: props.counts.down },
          ]}
        />
      </div>
      <div className="nxt-controls__meta">
        <div className="nxt-controls__chips">
          <button type="button" aria-pressed={props.watchedOnly} onClick={props.onWatchedOnly} className={cn('nxt-pill', props.watchedOnly && 'is-on')}>
            <Bookmark className={cn('size-3', props.watchedOnly && 'fill-copper text-copper')} />
            Watchlist only <span className="font-mono text-[10px]">{props.watchedCount}</span>
          </button>
          <button type="button" onClick={props.onFlip} className="nxt-pill" aria-label={`Sort order: ${props.ascending ? 'ascending' : 'descending'}. Click to reverse.`}>
            {props.ascending ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {props.ascending ? 'Ascending' : 'Descending'}
          </button>
          <span className="nxt-controls__count" aria-live="polite"><b>{props.shown}</b> of {props.total} {props.shown === 1 ? 'token' : 'tokens'}</span>
          {props.hasFilters ? (
            <button type="button" onClick={props.onReset} className="nxt-reset"><RotateCcw className="size-3" /> Reset</button>
          ) : null}
        </div>
        <Segmented<TokenView>
          label="Layout"
          value={props.view}
          onChange={props.onView}
          options={[
            { value: 'table', label: 'Table', icon: <Rows3 className="size-3.5" /> },
            { value: 'heat', label: 'Heat map', icon: <LayoutGrid className="size-3.5" /> },
          ]}
        />
      </div>
    </section>
  )
}
