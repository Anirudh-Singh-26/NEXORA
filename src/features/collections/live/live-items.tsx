import { motion } from 'motion/react'
import { CollectionArt } from '@/features/collections/components/collection-parts'
import { GridSkeleton, LoadMore, Note, RetryNote } from '@/features/collections/live/live-ui'
import type { CollectionItemsState } from '@/hooks/use-collection-items'
import { dur, ease } from '@/lib/motion'
import { itemPrice, type LiveItem } from '@/lib/nft-data/collection-extras'
import { fmtFloor, NO_VALUE } from '@/lib/nft-data/format'
import type { Amount } from '@/lib/nft-data/types'

/** Short, readable label for a token id (long Solana mints are truncated in the middle). */
const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 5)}…${id.slice(-4)}` : id)

/**
 * NFT tile in the old NEXORA item-card style: square artwork with the identifier chip, name, and one price line.
 * The price is real: an active listing, else the latest sale OpenSea reported; with neither it shows "—".
 * Tiles are not links (live items have no in-app asset page), so the only external hop stays "View on OpenSea".
 */
export function LiveItemCard({ item, collectionName, listings, lastSales }: { item: LiveItem; collectionName: string; listings: Record<string, Amount>; lastSales: Record<string, Amount> }) {
  const label = item.name ?? `${collectionName} #${shortId(item.identifier)}`
  const price = itemPrice(item, listings, lastSales)
  return (
    <motion.article whileHover={{ y: -3 }} transition={{ duration: dur.base, ease }} className="group min-w-0">
      <div className="nx-data-card overflow-hidden rounded-xl border border-line bg-gradient-to-br from-[#121727] to-[#0b0f1a] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_28px_-14px_rgba(0,0,0,0.7)] transition-[border-color,box-shadow] duration-300 group-hover:border-copper/35">
        <CollectionArt src={item.image} alt={label} fallbackLabel={shortId(item.identifier)} className="aspect-square w-full">
          <span className="absolute bottom-2.5 left-2.5 nx-artwork-label rounded-md border border-white/10 bg-canvas/60 px-1.5 py-0.5 font-mono text-[10px] text-ink/90 backdrop-blur" title={`Token ID ${item.identifier}`}>#{shortId(item.identifier)}</span>
        </CollectionArt>
        <div className="p-3">
          <p className="truncate text-[12.5px] font-medium leading-tight" title={label}>{label}</p>
          <p className="nx-eyebrow mt-1.5 text-[9px] tracking-[0.14em]">{price ? (price.kind === 'listed' ? 'Listed' : 'Last sale') : 'Price'}</p>
          <p className="font-mono text-[12.5px] tabular-nums">{price ? fmtFloor(price.amount) : NO_VALUE}</p>
        </div>
      </div>
    </motion.article>
  )
}

export function LiveItemsPanel({ state, items, collectionName }: { state: CollectionItemsState; items: LiveItem[]; collectionName: string }) {
  if (state.status === 'loading') return <GridSkeleton />
  if (state.status === 'error') return <RetryNote message={state.error ?? 'Items could not be loaded.'} onRetry={state.retry} busy={state.refreshing} />
  if (!items.length) return <Note>OpenSea returned no items for this collection.</Note>
  const pricedCount = items.filter((i) => itemPrice(i, state.listings, state.lastSales)).length
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => <LiveItemCard key={item.identifier} item={item} collectionName={collectionName} listings={state.listings} lastSales={state.lastSales} />)}
      </div>
      <p className="text-[11px] leading-5 text-mute">
        {items.length} item{items.length === 1 ? '' : 's'} loaded in the order OpenSea returns them; {pricedCount} {pricedCount === 1 ? 'has' : 'have'} a price.
        “Listed” is the active listing price and “Last sale” the latest sale in OpenSea’s recent-sales window; items outside those lookups show “—”, not zero.
        {state.unavailable.length ? ' Some price lookups were unavailable just now — use Refresh to retry.' : ''}
      </p>
      {state.next ? <LoadMore loading={state.loadingMore} error={state.loadMoreError} onClick={state.loadMore} label="Load more items" /> : null}
    </div>
  )
}
