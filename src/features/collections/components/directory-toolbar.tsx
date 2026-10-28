import { Grid2X2, List, Search, X } from 'lucide-react'
import { Segmented } from '@/components/shared/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CollectionSort } from '@/data/selectors'
import type { CollectionCategory, Network, NetworkId } from '@/data/types'
import { cn } from '@/lib/utils'

export type CollectionView = 'grid' | 'list'
type CategoryOption = { value: CollectionCategory | 'all'; label: string; count: number }

/**
 * Directory controls: search, network, sort, view on one row; category tabs
 * beneath. Counts on tabs and networks already respect the other filters.
 */
export function DirectoryToolbar({
  query, onQuery, network, onNetwork, networks, networkCounts, total,
  sort, onSort, view, onView, category, onCategory, categoryOptions,
}: {
  query: string
  onQuery: (v: string) => void
  network: NetworkId | 'all'
  onNetwork: (v: NetworkId | 'all') => void
  networks: Network[]
  networkCounts: Record<string, number>
  total: number
  sort: CollectionSort
  onSort: (v: CollectionSort) => void
  view: CollectionView
  onView: (v: CollectionView) => void
  category: CollectionCategory | 'all'
  onCategory: (v: CollectionCategory | 'all') => void
  categoryOptions: CategoryOption[]
}) {
  return (
    <div className="nxc-toolbar nx-sticky-bar">
      <div className="nxc-toolbar__row">
        <label className="nx-field nxc-search">
          <Search className="pointer-events-none absolute left-3 size-4 text-mute" />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search collections or studios" aria-label="Search collections or studios" />
          {query ? (
            <button type="button" onClick={() => onQuery('')} aria-label="Clear search" className="absolute right-2 rounded p-1 text-mute hover:text-ink"><X className="size-3.5" /></button>
          ) : null}
        </label>
        <div className="nxc-toolbar__selects">
          <Select value={network} onValueChange={(v) => onNetwork(v as NetworkId | 'all')}>
            <SelectTrigger className="h-9" aria-label="Network"><SelectValue placeholder="Network" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All networks ({networkCounts.all ?? total})</SelectItem>
              {networks.map((n) => (
                <SelectItem key={n.id} value={n.id} disabled={(networkCounts[n.id] ?? 0) === 0 && n.id !== network}>{n.name} ({networkCounts[n.id] ?? 0})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => onSort(v as CollectionSort)}>
            <SelectTrigger className="h-9" aria-label="Sort by"><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="volume">Highest volume</SelectItem>
              <SelectItem value="floor">Lowest floor</SelectItem>
              <SelectItem value="items">Item count</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Segmented<CollectionView>
          label="Collection display mode"
          value={view}
          onChange={onView}
          options={[
            { value: 'grid', label: 'Grid', icon: <Grid2X2 className="size-3.5" /> },
            { value: 'list', label: 'List', icon: <List className="size-3.5" /> },
          ]}
        />
      </div>
      <div className="nxc-tabs" role="group" aria-label="Category">
        {categoryOptions.map((o) => {
          const active = o.value === category
          return (
            <button key={o.value} type="button" aria-pressed={active} disabled={o.count === 0 && !active} onClick={() => onCategory(o.value)} className={cn('nxc-tab', active && 'is-active')}>
              <span className="capitalize">{o.label}</span>
              <span className="nxc-tab__count">{o.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
