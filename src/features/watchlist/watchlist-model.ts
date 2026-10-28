import { catalog, nftItems } from '@/data/catalog'
import { getCollectionById, getToken } from '@/data/selectors'
import type { Campaign, NetworkId, Token } from '@/data/types'
import { formatCompact, formatFloor, formatUsd } from '@/lib/format'
import { describeMint } from '@/features/workspaces/drops/drops-data'

export type WatchKind = 'token' | 'collection' | 'asset' | 'campaign'
export type WatchSort = 'type' | 'name' | 'network' | 'move'

export type WatchRow = {
  key: string
  kind: WatchKind
  id: string
  name: string
  sub: string
  href: string
  networkId?: NetworkId
  /** Headline figure and what it is (Price, Floor, Last sale, Mint). */
  value: string
  valueLabel: string
  /** 24h change, tokens only: the catalogue has no change series for other kinds. */
  change?: number
  note?: string
  status?: Campaign['status']
  spark?: number[]
  token?: Token
  image?: string
  /** 0 = most recently saved within its kind. */
  recency: number
}

export const KIND_ORDER: WatchKind[] = ['token', 'collection', 'asset', 'campaign']
export const KIND_LABEL: Record<WatchKind, string> = { token: 'Token', collection: 'Collection', asset: 'Asset', campaign: 'Campaign' }

type Saved = { tokenIds: string[]; collectionIds: string[]; assetIds: string[]; campaignIds: string[] }

/** Joins saved ids to catalogue records. Ids that no longer resolve are skipped, as before. */
export function buildWatchRows(saved: Saved): WatchRow[] {
  const rows: WatchRow[] = []

  saved.tokenIds.forEach((id, i) => {
    const token = getToken(id)
    if (!token) return
    rows.push({
      key: `token:${id}`, kind: 'token', id, name: token.name, sub: token.ticker, href: `/tokens/${id}`, networkId: token.networkId,
      value: formatUsd(token.price), valueLabel: 'Price', change: token.change24h, spark: token.sparkline, token,
      recency: saved.tokenIds.length - 1 - i,
    })
  })

  saved.collectionIds.forEach((id, i) => {
    const c = getCollectionById(id)
    if (!c) return
    rows.push({
      key: `collection:${id}`, kind: 'collection', id, name: c.name, sub: `by ${c.creator}`, href: `/collections/${c.slug}`, networkId: c.networkId,
      value: formatFloor(c.floor, c.floorSymbol), valueLabel: 'Floor', note: `24h vol ${formatCompact(c.volume24h)}`, image: c.cover,
      recency: saved.collectionIds.length - 1 - i,
    })
  })

  saved.assetIds.forEach((id, i) => {
    const nft = nftItems.find((item) => item.id === id)
    const c = nft ? getCollectionById(nft.collectionId) : undefined
    if (!nft || !c) return
    rows.push({
      key: `asset:${id}`, kind: 'asset', id, name: nft.name, sub: c.name, href: `/assets/${id}`, networkId: nft.networkId,
      value: `${nft.lastSale} ${c.floorSymbol}`, valueLabel: 'Last sale', note: `#${nft.tokenId}`, image: nft.image,
      recency: saved.assetIds.length - 1 - i,
    })
  })

  saved.campaignIds.forEach((id, i) => {
    const campaign = catalog.campaigns.find((item) => item.id === id)
    if (!campaign) return
    const c = getCollectionById(campaign.collectionId)
    rows.push({
      key: `campaign:${id}`, kind: 'campaign', id, name: campaign.title, sub: campaign.subtitle, href: c ? `/collections/${c.slug}` : '/drops',
      networkId: campaign.networkId ?? c?.networkId,
      value: describeMint(campaign) ?? '—', valueLabel: 'Mint', note: campaign.startsAt, status: campaign.status, image: campaign.cover,
      recency: saved.campaignIds.length - 1 - i,
    })
  })

  return rows
}

export function sortRows(rows: WatchRow[], sort: WatchSort): WatchRow[] {
  const copy = [...rows]
  const kindRank = (r: WatchRow) => KIND_ORDER.indexOf(r.kind)
  if (sort === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (sort === 'network') return copy.sort((a, b) => (a.networkId ?? '~').localeCompare(b.networkId ?? '~') || kindRank(a) - kindRank(b) || a.recency - b.recency)
  if (sort === 'move') return copy.sort((a, b) => Math.abs(b.change ?? -1) - Math.abs(a.change ?? -1) || kindRank(a) - kindRank(b) || a.recency - b.recency)
  return copy.sort((a, b) => kindRank(a) - kindRank(b) || a.recency - b.recency)
}

export const SORT_LABELS: Record<WatchSort, string> = {
  type: 'Type, newest first',
  name: 'Name A–Z',
  network: 'Network',
  move: 'Biggest 24h move',
}
