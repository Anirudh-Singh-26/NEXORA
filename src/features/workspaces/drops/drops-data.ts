import { airdropOpportunities, catalog } from '@/data/catalog'
import { getCollectionById, getToken } from '@/data/selectors'
import type { Campaign, NetworkId } from '@/data/types'

export type Airdrop = (typeof airdropOpportunities)[number]
export type StatusFilter = 'all' | Campaign['status']
export type DropSort = 'catalog' | 'title' | 'supply' | 'price'

export type DropFilters = {
  query: string
  status: StatusFilter
  network: NetworkId | 'all'
  reward: string
  sort: DropSort
}

export const SORT_LABELS: Record<DropSort, string> = {
  catalog: 'Catalog order',
  title: 'Title A–Z',
  supply: 'Largest supply',
  price: 'Lowest mint price',
}

/** Distinct reward types present in the data, so the filter never offers an empty choice. */
export function rewardOptions(): string[] {
  const values = new Set<string>()
  for (const c of catalog.campaigns) if (c.rewardType) values.add(c.rewardType)
  for (const a of airdropOpportunities) if (a.rewardType) values.add(String(a.rewardType))
  return [...values].sort()
}

function sortCampaigns(list: Campaign[], sort: DropSort): Campaign[] {
  if (sort === 'catalog') return list
  const copy = [...list]
  if (sort === 'title') return copy.sort((a, b) => a.title.localeCompare(b.title))
  if (sort === 'supply') return copy.sort((a, b) => (b.supply ?? -1) - (a.supply ?? -1))
  return copy.sort((a, b) => (a.mintPrice ?? Infinity) - (b.mintPrice ?? Infinity))
}

/** Campaigns matching everything except status (so status counts stay meaningful). */
export function matchCampaigns(f: Omit<DropFilters, 'status'>): Campaign[] {
  const q = f.query.trim().toLowerCase()
  const matched = catalog.campaigns.filter(
    (c) =>
      `${c.title} ${c.subtitle}`.toLowerCase().includes(q) &&
      (f.network === 'all' || c.networkId === f.network) &&
      (f.reward === 'all' || c.rewardType === f.reward),
  )
  return sortCampaigns(matched, f.sort)
}

export function matchAirdrops(f: Omit<DropFilters, 'status' | 'sort'>): Airdrop[] {
  const q = f.query.trim().toLowerCase()
  return airdropOpportunities.filter(
    (a) =>
      (!q || `${a.title} ${a.eligibilitySummary} ${a.status}`.toLowerCase().includes(q)) &&
      (f.network === 'all' || a.networkId === f.network) &&
      (f.reward === 'all' || String(a.rewardType) === f.reward),
  )
}

/** "0.05 ETH", "Free mint" or undefined, using only the data attached to the campaign. */
export function describeMint(campaign: Campaign): string | undefined {
  if (campaign.mintPrice === undefined) return undefined
  if (campaign.mintPrice === 0) return 'Free mint'
  const unit = (campaign.mintCurrencyTokenId ? getToken(campaign.mintCurrencyTokenId)?.ticker : undefined) ?? getCollectionById(campaign.collectionId)?.floorSymbol
  return `${campaign.mintPrice}${unit ? ` ${unit}` : ''}`
}
