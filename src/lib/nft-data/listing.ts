import type { CollectionCategory, NetworkId } from '../../data/types.ts'
import type { ListedCollection } from './types.ts'

export type ListingSort = 'volume' | 'floor' | 'items' | 'name'

export interface ListingFilter {
  query: string
  network: NetworkId | 'all'
  category: CollectionCategory | 'all'
  sort: ListingSort
}

/** Highest first; unknown (null) values always last. */
const desc = (a: number | null, b: number | null) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : b - a)

/**
 * Same filtering and sort semantics as `filterCollections`, over nullable rows.
 * - volume: live rows keep the provider's 24h-volume rank (units differ per chain, so values are not comparable);
 *   demo rows sort by number.
 * - floor: lowest first, grouped by currency (first-seen order of the provider rank), unknown floors last.
 */
export function filterListed(rows: ListedCollection[], o: ListingFilter): ListedCollection[] {
  const q = o.query.trim().toLowerCase()
  const filtered = rows.filter((c) =>
    (q.length === 0 || c.name.toLowerCase().includes(q) || (c.creator ?? '').toLowerCase().includes(q)) &&
    (o.network === 'all' || c.networkId === o.network) &&
    (o.category === 'all' || c.category === o.category),
  )
  const symbolOrder = new Map<string, number>()
  for (const c of rows) if (c.floor && !symbolOrder.has(c.floor.symbol)) symbolOrder.set(c.floor.symbol, symbolOrder.size)

  return filtered.sort((a, b) => {
    switch (o.sort) {
      case 'volume':
        if (a.rank !== undefined && b.rank !== undefined) return a.rank - b.rank
        return desc(a.volume24h?.value ?? null, b.volume24h?.value ?? null)
      case 'floor': {
        if (!a.floor || !b.floor) return a.floor ? -1 : b.floor ? 1 : 0
        const g = (symbolOrder.get(a.floor.symbol) ?? 0) - (symbolOrder.get(b.floor.symbol) ?? 0)
        return g !== 0 ? g : a.floor.value - b.floor.value
      }
      case 'items': return desc(a.items, b.items)
      default: return a.name.localeCompare(b.name)
    }
  })
}
