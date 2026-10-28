import { airdropOpportunities, catalog, equityMarketSeeds, marketplaceListings, marketplaceSellers, nftItems } from '@/data/catalog'
import type { Collection, CollectionCategory, NetworkId, Token } from '@/data/types'

export function getNetwork(id: NetworkId) {
  return catalog.networks.find((network) => network.id === id)
}

export function getToken(id: string) {
  return catalog.tokens.find((token) => token.id === id)
}

export function getCollection(slug: string) {
  return catalog.collections.find((collection) => collection.slug === slug)
}

export function getCollectionById(id: string) {
  return catalog.collections.find((collection) => collection.id === id)
}

export function tokensOnNetwork(networkId: NetworkId) {
  return catalog.tokens.filter((token) => token.networkId === networkId)
}

export function collectionsOnNetwork(networkId: NetworkId) {
  return catalog.collections.filter((collection) => collection.networkId === networkId)
}

export type CollectionSort = 'volume' | 'floor' | 'items' | 'name'
export type TokenSort = 'marketCap' | 'volume' | 'change' | 'price' | 'name'

export function filterCollections(options: {
  query: string
  network: NetworkId | 'all'
  category: CollectionCategory | 'all'
  sort: CollectionSort
}): Collection[] {
  const q = options.query.trim().toLowerCase()
  const filtered = catalog.collections.filter((collection) => {
    const matchesQuery =
      q.length === 0 ||
      collection.name.toLowerCase().includes(q) ||
      collection.creator.toLowerCase().includes(q)
    const matchesNetwork = options.network === 'all' || collection.networkId === options.network
    const matchesCategory = options.category === 'all' || collection.category === options.category
    return matchesQuery && matchesNetwork && matchesCategory
  })

  return filtered.sort((a, b) => {
    if (options.sort === 'volume') return b.volume24h - a.volume24h
    if (options.sort === 'floor') return a.floor - b.floor
    if (options.sort === 'items') return b.items - a.items
    return a.name.localeCompare(b.name)
  })
}

export function filterTokens(options: {
  query: string
  network: NetworkId | 'all'
  sort: TokenSort
  /** Optional token list to filter instead of the demo catalogue (e.g. live-quoted tokens). */
  tokens?: Token[]
}): Token[] {
  const q = options.query.trim().toLowerCase()
  const filtered = (options.tokens ?? catalog.tokens).filter((token) => {
    const matchesQuery =
      q.length === 0 ||
      token.name.toLowerCase().includes(q) ||
      token.ticker.toLowerCase().includes(q)
    const matchesNetwork = options.network === 'all' || token.networkId === options.network
    return matchesQuery && matchesNetwork
  })

  return filtered.sort((a, b) => {
    if (options.sort === 'marketCap') return b.marketCap - a.marketCap
    if (options.sort === 'volume') return b.volume24h - a.volume24h
    if (options.sort === 'change') return b.change24h - a.change24h
    if (options.sort === 'price') return b.price - a.price
    return a.name.localeCompare(b.name)
  })
}

export function searchCatalog(query: string) {
  const q = query.trim().toLowerCase()
  const matches = (value: string) => !q || value.toLowerCase().includes(q)
  const assets = nftItems.filter((asset) =>
    matches(asset.name) || matches(asset.tokenId) || matches(asset.collectionName),
  )

  return {
    tokens: catalog.tokens.filter((token) => matches(token.name) || matches(token.ticker)).slice(0, 8),
    collections: catalog.collections.filter((collection) => matches(collection.name) || matches(collection.creator)).slice(0, 8),
    projects: catalog.projects.filter((project) => matches(project.name) || matches(project.tagline)).slice(0, 6),
    campaigns: catalog.campaigns.filter((campaign) => matches(campaign.title) || matches(campaign.subtitle)).slice(0, 6),
    airdrops: airdropOpportunities.filter((drop) => matches(drop.title) || matches(drop.eligibilitySummary)).slice(0, 6),
    assets: assets.slice(0, 8),
  }
}

export { collectionCategories as categories } from '@/data/nexora-data'


/** Relationship selectors: use IDs as foreign keys instead of duplicating records. */
export function getCampaign(id: string) { return catalog.campaigns.find((campaign) => campaign.id === id) }
export function getProject(id: string) { return catalog.projects.find((project) => project.id === id) }
export function getTokenByTicker(ticker: string) {
  const normalized = ticker.trim().toLowerCase()
  return catalog.tokens.find((token) => token.ticker.toLowerCase() === normalized)
}
export function campaignsForCollection(collectionId: string) {
  return catalog.campaigns.filter((campaign) => campaign.collectionId === collectionId)
}
export function projectsForCollection(collectionId: string) {
  return catalog.projects.filter((project) => project.collectionId === collectionId)
}
export function collectionsQuotedInToken(tokenId: string) {
  return catalog.collections.filter((collection) => collection.linkedTokenId === tokenId)
}
export function getLinkedQuoteToken(collectionId: string) {
  const collection = getCollectionById(collectionId)
  return collection?.linkedTokenId ? getToken(collection.linkedTokenId) : undefined
}

/** Selectors for the expanded research and marketplace fixtures. */
export function getAirdropOpportunity(id: string) {
  return airdropOpportunities.find((drop) => drop.id === id)
}
export function airdropsForProject(projectId: string) {
  return airdropOpportunities.filter((drop) => drop.projectId === projectId)
}
export function listingsForCollection(collectionId: string) {
  return marketplaceListings.filter((listing) => listing.collectionId === collectionId)
}
export function listingsForNft(nftId: string) {
  return marketplaceListings.filter((listing) => listing.nftId === nftId)
}
export function getMarketplaceSeller(id: string) {
  return marketplaceSellers.find((seller) => seller.id === id)
}
export function getEquityMarketSeed(ticker: string) {
  const normalized = ticker.trim().toLowerCase()
  return equityMarketSeeds.find((asset) => asset.ticker.toLowerCase() === normalized)
}
