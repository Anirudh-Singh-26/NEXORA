import { catalog } from '@/data/catalog'
import type { Collection, Network, NetworkId, Project, Token } from '@/data/types'

export type AtlasEntry = {
  network: Network
  tokens: Token[]
  collections: Collection[]
  projects: Project[]
  /** Sum of the illustrative market caps of tokens issued on this network. */
  cap: number
  /** Sum of the illustrative 24h volume of collections on this network. */
  volume: number
  /** Node weight for the atlas: everything the catalogue links to the network. */
  activity: number
}

export type CompareMetric = 'projects' | 'collections' | 'tokens' | 'cap'

/** One entry per network in the catalogue, derived purely from existing relationships. */
export function buildAtlas(): AtlasEntry[] {
  return catalog.networks.map((network) => {
    const tokens = catalog.tokens.filter((t) => t.networkId === network.id)
    const collections = catalog.collections.filter((c) => c.networkId === network.id)
    const projects = catalog.projects.filter((p) => p.networkId === network.id)
    return {
      network,
      tokens,
      collections,
      projects,
      cap: tokens.reduce((s, t) => s + t.marketCap, 0),
      volume: collections.reduce((s, c) => s + c.volume24h, 0),
      activity: tokens.length + collections.length + projects.length,
    }
  })
}

export function metricValue(entry: AtlasEntry, metric: CompareMetric) {
  if (metric === 'projects') return entry.projects.length
  if (metric === 'collections') return entry.collections.length
  if (metric === 'tokens') return entry.tokens.length
  return entry.cap
}

export type NetworkSelection = NetworkId | 'all'
