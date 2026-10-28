import { Search, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Network, NetworkId } from '@/data/types'
import { cn } from '@/lib/utils'
import { SORT_LABELS, type DropSort, type StatusFilter } from '@/features/workspaces/drops/drops-data'

type Counts = Record<StatusFilter, number>

const STATUS_CELLS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ended', label: 'Ended' },
]

/** Status board (doubles as the status filter) plus search, network, reward and sort. */
export function DropsCommandBar(props: {
  counts: Counts
  status: StatusFilter; onStatus: (v: StatusFilter) => void
  query: string; onQuery: (v: string) => void
  network: NetworkId | 'all'; onNetwork: (v: NetworkId | 'all') => void; networks: Network[]
  reward: string; onReward: (v: string) => void; rewards: string[]
  sort: DropSort; onSort: (v: DropSort) => void
  hasFilters: boolean; onReset: () => void
}) {
  return (
    <div className="nxd-command nx-sticky-bar">
      <div className="nxd-board" role="group" aria-label="Campaign status">
        {STATUS_CELLS.map((cell) => (
          <button key={cell.value} type="button" aria-pressed={props.status === cell.value} onClick={() => props.onStatus(cell.value)} className={cn('nxd-board__cell', `is-${cell.value}`)}>
            <span className="nxd-board__label">{cell.value === 'live' ? <span className="nx-live-dot" /> : <i aria-hidden />}{cell.label}</span>
            <b>{props.counts[cell.value]}</b>
          </button>
        ))}
      </div>
      <div className="nxd-filters">
        <label className="nx-field nxd-search">
          <Search className="pointer-events-none absolute left-3 size-4 text-mute" />
          <input value={props.query} onChange={(e) => props.onQuery(e.target.value)} placeholder="Search campaigns" aria-label="Search campaigns" />
          {props.query ? <button type="button" onClick={() => props.onQuery('')} aria-label="Clear search" className="absolute right-2 rounded p-1 text-mute hover:text-ink"><X className="size-3.5" /></button> : null}
        </label>
        <Select value={props.network} onValueChange={(v) => props.onNetwork(v as NetworkId | 'all')}>
          <SelectTrigger className="h-9" aria-label="Network"><SelectValue placeholder="Network" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All networks</SelectItem>
            {props.networks.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={props.reward} onValueChange={props.onReward}>
          <SelectTrigger className="h-9" aria-label="Reward type"><SelectValue placeholder="Reward" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any reward</SelectItem>
            {props.rewards.map((r) => <SelectItem key={r} value={r}><span className="capitalize">{r}</span></SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={props.sort} onValueChange={(v) => props.onSort(v as DropSort)}>
          <SelectTrigger className="h-9" aria-label="Sort campaigns"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as DropSort[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>)}
          </SelectContent>
        </Select>
        {props.hasFilters ? <button type="button" onClick={props.onReset} className="nxd-reset">Reset</button> : null}
      </div>
    </div>
  )
}
