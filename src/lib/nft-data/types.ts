import type { CollectionCategory, NetworkId } from '../../data/types.ts'

export type CollectionSource = 'live' | 'demo'

/** A quantity with its currency. `symbol` is '' only for demo volumes, which never carried a unit. */
export interface Amount { value: number; symbol: string }

/**
 * What the Collections page renders. Unlike the demo `Collection`, every market figure may be `null`
 * ("provider did not supply it") so the UI shows "—" instead of a false zero.
 */
export interface ListedCollection {
  id: string
  slug: string
  name: string
  networkId: NetworkId
  category: CollectionCategory | null
  creator: string | null
  description: string | null
  cover: string | null
  banner: string | null
  floor: Amount | null
  volume24h: Amount | null
  items: number | null
  owners: number | null
  /** Sample item artwork for the tile reel (demo only). */
  preview: string[]
  /** Provider rank by 24h volume (live only). */
  rank?: number
  source: CollectionSource
  /** Live collections link out to the provider; demo collections use the in-app detail route. */
  externalUrl?: string
}

export type CollectionsErrorKind =
  | 'not-configured' | 'upstream-auth' | 'proxy-missing' | 'rate-limited'
  | 'timeout' | 'network' | 'http' | 'malformed' | 'aborted'

export interface LiveCollectionsSnapshot {
  collections: ListedCollection[]
  /** Epoch ms when the proxy assembled the data from OpenSea. */
  fetchedAt: number
  /** True when some per-collection statistics are missing (shown as "—"). */
  partial: boolean
}
