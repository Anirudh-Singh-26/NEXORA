import { activitySeeds, campaignById, catalog } from '@/data/catalog'
import { getCollection, getCollectionById, getToken } from '@/data/selectors'
import type { Campaign, NetworkId } from '@/data/types'
import { formatCompact, formatFloor, formatPercent, formatUsd } from '@/lib/format'

export type ActivityKind = 'token' | 'collection' | 'campaign' | 'watchlist'
export type TimeFilter = 'all' | 'Today' | 'Earlier'

export type Fact = { label: string; value: string; tone?: 'up' | 'down' }

export type ActivityEvent = {
  id: string
  kind: ActivityKind
  type: string
  title: string
  time: string
  group: 'Today' | 'Earlier'
  href: string
  networkId?: NetworkId
  facts: Fact[]
  status?: Campaign['status']
  /** True when the event names a catalogue record that cannot be found. */
  unavailable: boolean
}

export const KINDS: ActivityKind[] = ['token', 'collection', 'campaign', 'watchlist']
export const KIND_LABEL: Record<ActivityKind, string> = { token: 'Tokens', collection: 'Collections', campaign: 'Drops', watchlist: 'Watchlist' }

type Seed = { id: string; kind: ActivityKind; type: string; title: string; time: string; group: 'Today' | 'Earlier'; href: string; entityRef?: string }

/** Attaches the catalogue record each event refers to (network, figures, status). */
function enrich(seed: Seed): ActivityEvent {
  const base = { id: seed.id, kind: seed.kind, type: seed.type, title: seed.title, time: seed.time, group: seed.group, href: seed.href }
  const ref = seed.entityRef

  if (seed.kind === 'token' && ref) {
    const token = getToken(ref)
    if (!token) return { ...base, facts: [], unavailable: true }
    return {
      ...base, networkId: token.networkId, unavailable: false,
      facts: [
        { label: 'Quote', value: formatUsd(token.price) },
        { label: '24h', value: formatPercent(token.change24h), tone: token.change24h >= 0 ? 'up' : 'down' },
      ],
    }
  }
  if (seed.kind === 'collection' && ref) {
    const c = getCollectionById(ref) ?? getCollection(ref)
    if (!c) return { ...base, facts: [], unavailable: true }
    return {
      ...base, networkId: c.networkId, unavailable: false,
      facts: [{ label: 'Floor', value: formatFloor(c.floor, c.floorSymbol) }, { label: '24h vol', value: formatCompact(c.volume24h) }],
    }
  }
  if (seed.kind === 'campaign' && ref) {
    const campaign = campaignById[ref]
    if (!campaign) return { ...base, facts: [], unavailable: true }
    const c = getCollectionById(campaign.collectionId)
    return {
      ...base, networkId: campaign.networkId ?? c?.networkId, status: campaign.status, unavailable: false,
      facts: [{ label: 'Schedule', value: campaign.startsAt }],
    }
  }
  if (seed.kind === 'watchlist') return { ...base, facts: [{ label: 'Scope', value: 'This browser only' }], unavailable: false }
  return { ...base, facts: [], unavailable: Boolean(ref) }
}

/** Demo events: the catalogue's seeded feed plus two entries derived from current quotes. */
export function buildEvents(): ActivityEvent[] {
  const topCollection = [...catalog.collections].sort((a, b) => b.volume24h - a.volume24h)[0]
  const loser = [...catalog.tokens].sort((a, b) => a.change24h - b.change24h)[0]
  const derived: Seed[] = []
  if (topCollection) derived.push({ id: 'derived-collection', kind: 'collection', type: 'Collection signal', title: `${topCollection.name} leads demo 24h volume`, time: 'Yesterday', group: 'Earlier', href: `/collections/${topCollection.slug}`, entityRef: topCollection.id })
  if (loser) derived.push({ id: 'derived-token', kind: 'token', type: 'Token movement', title: `${loser.ticker} demo quote moved ${formatPercent(loser.change24h)}`, time: 'Yesterday', group: 'Earlier', href: `/tokens/${loser.id}`, entityRef: loser.id })
  return [...activitySeeds, ...derived].map(enrich)
}
