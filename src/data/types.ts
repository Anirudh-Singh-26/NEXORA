export type NetworkId =
  | 'ethereum'
  | 'solana'
  | 'base'
  | 'polygon'
  | 'arbitrum'
  | 'avalanche'
  | 'optimism'

export type CollectionCategory =
  | 'art'
  | 'identity'
  | 'gaming'
  | 'photography'
  | 'membership'

export type Network = {
  id: NetworkId
  name: string
  shortName: string
  nativeSymbol: string
  color: string
  layer?: 'L1' | 'L2'
  chainId?: number
  docsUrl?: string
  explorerUrl?: string
  nativeTokenId?: string
  summary?: string
}

export type SparkPoint = number

export type Token = {
  id: string
  ticker: string
  name: string
  networkId: NetworkId
  price: number
  change24h: number
  marketCap: number
  volume24h: number
  sparkline: SparkPoint[]
  description: string
  demoNote?: string
  assetClass?: 'native' | 'governance' | 'stablecoin' | 'wrapped' | 'fictional' | 'reference'
  decimals?: number
  isStablecoin?: boolean
  verifiedProject?: boolean
  badgeIds?: string[]
  supportedNetworkIds?: NetworkId[]
}

export type NftAttribute = { traitType: string; value: string | number }

export type NftItem = {
  id: string
  tokenId: string
  name: string
  image: string
  lastSale: number
  description?: string
  rarity?: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary'
  attributes?: NftAttribute[]
  badgeIds?: string[]
  creatorId?: string
  assetId?: string
  imageAlt?: string
  isIllustrative?: boolean
  collectionSupply?: number
  creatorName?: string
  networkName?: string
  contentType?: string
  provenance?: string
  utility?: string
  curatorNote?: string
  rarityBasis?: string
  lastSaleContext?: string
}

export type Collection = {
  id: string
  slug: string
  name: string
  networkId: NetworkId
  category: CollectionCategory
  floor: number
  floorSymbol: string
  volume24h: number
  items: number
  owners: number
  cover: string
  banner: string
  description: string
  creator: string
  nfts: NftItem[]
  linkedTokenId?: string
  badgeIds?: string[]
  tags?: string[]
  standard?: string
  royaltyBps?: number
  verificationStatus?: 'unverified' | 'demo-only' | 'verified'
  creatorId?: string
  mintStatus?: 'complete' | 'ongoing' | 'not-started' | 'unknown'
  supplyDescription?: string
  marketContext?: string
}

export type Project = {
  id: string
  name: string
  tagline: string
  networkId: NetworkId
  category: string
  cover: string
  collectionId?: string
  badgeIds?: string[]
  status?: 'active' | 'building' | 'archived'
  tags?: string[]
  websiteUrl?: string
  creatorId?: string
}

export type Campaign = {
  id: string
  title: string
  subtitle: string
  startsAt: string
  status: 'live' | 'upcoming' | 'ended'
  collectionId: string
  cover: string
  networkId?: NetworkId
  creatorId?: string
  badgeIds?: string[]
  rewardType?: 'nft' | 'token' | 'points' | 'membership'
  supply?: number
  mintPrice?: number
  mintCurrencyTokenId?: string
  eligibilitySummary?: string
  isIllustrative?: boolean
}

export type Catalog = {
  networks: Network[]
  tokens: Token[]
  collections: Collection[]
  projects: Project[]
  campaigns: Campaign[]
}
