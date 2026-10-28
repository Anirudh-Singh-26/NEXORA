import type { Token } from '../../data/types.ts'
import type { ListedCollection } from '../nft-data/types.ts'

/** Top tokens for the Discover rail by 24h volume. Pure; never mutates the input. */
export function pickRailTokens(tokens: readonly Token[], limit = 8): Token[] {
  return [...tokens].sort((a, b) => b.volume24h - a.volume24h).slice(0, Math.max(0, limit))
}

/**
 * Live collections for the Discover rail, in provider rank order. Only rows that can render an honest card are kept:
 * a name and a route are always present on parsed rows, and a collection without a cover image is still shown
 * (MediaImage renders a lettered fallback), so nothing is filtered out except non-live rows.
 */
export function pickRailCollections(collections: readonly ListedCollection[], limit = 12): ListedCollection[] {
  return collections
    .filter((c) => c.source === 'live')
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))
    .slice(0, Math.max(0, limit))
}

/** In-app route for a live collection (same shape the Collections page uses). */
export function liveCollectionHref(collection: Pick<ListedCollection, 'slug'>): string {
  return `/collections/${encodeURIComponent(collection.slug)}?source=opensea`
}
