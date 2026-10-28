/**
 * Typed client for NEXORA's `/api/collection?slug=` proxy (see api/collection.ts). The browser never sees an API
 * key. The payload is validated field by field; anything missing becomes `null` and renders as "—".
 */
import type { NetworkId } from '../../data/types.ts'
import { collectionsErrorMessage, shortOwner } from './collections.ts'
import type { Amount, CollectionsErrorKind } from './types.ts'

export type CollectionDetailErrorKind = CollectionsErrorKind | 'not-found' | 'invalid-slug'

export class CollectionDetailError extends Error {
  kind: CollectionDetailErrorKind
  constructor(kind: CollectionDetailErrorKind, message: string) { super(message); this.name = 'CollectionDetailError'; this.kind = kind }
}

export function collectionDetailErrorMessage(kind: CollectionDetailErrorKind): string {
  if (kind === 'not-found') return 'OpenSea has no collection with this address.'
  if (kind === 'invalid-slug') return 'This collection address is not valid.'
  return collectionsErrorMessage(kind)
}

export interface IntervalStats {
  volume: Amount | null
  /** Absolute change vs the previous interval (can be negative). */
  volumeDiff: Amount | null
  sales: number | null
  salesDiff: number | null
  averagePrice: Amount | null
}
export interface CollectionStats {
  totalVolume: Amount | null
  totalSales: number | null
  averagePrice: Amount | null
  marketCap: Amount | null
  intervals: { oneDay: IntervalStats | null; sevenDay: IntervalStats | null; thirtyDay: IntervalStats | null }
}
export interface CollectionContract { address: string; networkId: NetworkId | null }
export interface CollectionFee { fee: number; required: boolean; recipient: string | null }
export interface CollectionLinks {
  projectUrl: string | null; wikiUrl: string | null; discordUrl: string | null; telegramUrl: string | null
  twitterUrl: string | null; instagramUrl: string | null
}
export interface TraitCategory { name: string; type: string | null; distinctValues: number; values: { value: string; count: number }[] }
export interface CollectionTraits { totalCategories: number; categories: TraitCategory[] }
export interface SampleItem { identifier: string; name: string | null; image: string | null }
export type DetailSection = 'stats' | 'traits' | 'items'

export interface LiveCollectionDetail {
  slug: string
  name: string
  description: string | null
  cover: string | null
  banner: string | null
  category: string | null
  /** Null when OpenSea reports a chain NEXORA does not list. */
  networkId: NetworkId | null
  creator: string | null
  /** Full owner address (the short form in `creator` is for display only). */
  ownerAddress: string | null
  openseaUrl: string
  floor: Amount | null
  volume24h: Amount | null
  items: number | null
  owners: number | null
  sales24h: number | null
  createdDate: string | null
  verified: boolean | null
  contracts: CollectionContract[]
  fees: CollectionFee[]
  links: CollectionLinks
  stats: CollectionStats | null
  traits: CollectionTraits | null
  sampleItems: SampleItem[]
}

export interface LiveCollectionDetailSnapshot {
  collection: LiveCollectionDetail
  fetchedAt: number
  partial: boolean
  /** Optional sections whose upstream request failed (as opposed to being genuinely empty). */
  unavailable: DetailSection[]
}

const NETWORKS: readonly NetworkId[] = ['ethereum', 'solana', 'base', 'polygon', 'arbitrum', 'avalanche', 'optimism']
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,99}$/i
const CACHE_MS = 5 * 60_000
const TIMEOUT_MS = 15_000

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const posInt = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
function httpsUrl(v: unknown): string | null {
  const s = text(v)
  if (!s) return null
  try { return new URL(s).protocol === 'https:' ? s : null } catch { return null }
}
function amount(v: unknown, allowZero: boolean, allowNegative = false): Amount | null {
  if (!isRecord(v)) return null
  const value = v.value
  const symbol = text(v.symbol)
  if (typeof value !== 'number' || !Number.isFinite(value) || (!allowNegative && value < 0) || (!allowZero && value === 0) || !symbol) return null
  return { value, symbol }
}
const count = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const USERNAME_RE = /^[A-Za-z0-9_.]{1,40}$/

function interval(v: unknown): IntervalStats | null {
  if (!isRecord(v)) return null
  const out: IntervalStats = {
    volume: amount(v.volume, true), volumeDiff: amount(v.volumeDiff, true, true),
    sales: count(v.sales), salesDiff: finite(v.salesDiff), averagePrice: amount(v.averagePrice, true),
  }
  return Object.values(out).every((x) => x === null) ? null : out
}

function parseStats(v: unknown): CollectionStats | null {
  if (!isRecord(v)) return null
  const iv = isRecord(v.intervals) ? v.intervals : {}
  return {
    totalVolume: amount(v.totalVolume, true), totalSales: count(v.totalSales),
    averagePrice: amount(v.averagePrice, true), marketCap: amount(v.marketCap, true),
    intervals: { oneDay: interval(iv.oneDay), sevenDay: interval(iv.sevenDay), thirtyDay: interval(iv.thirtyDay) },
  }
}

function parseTraits(v: unknown): CollectionTraits | null {
  if (!isRecord(v) || !Array.isArray(v.categories)) return null
  const categories: TraitCategory[] = []
  for (const c of v.categories) {
    if (!isRecord(c) || !Array.isArray(c.values)) continue
    const name = text(c.name)
    const values = c.values.flatMap((x) => (isRecord(x) && text(x.value) && count(x.count) !== null ? [{ value: x.value as string, count: x.count as number }] : []))
    if (!name || values.length === 0) continue
    categories.push({ name, type: text(c.type), distinctValues: Math.max(posInt(c.distinctValues) ?? 0, values.length), values })
  }
  return categories.length ? { totalCategories: Math.max(posInt(v.totalCategories) ?? 0, categories.length), categories } : null
}

/** Pure parser for the proxy payload. An unusable payload throws `malformed`; optional sections degrade to null/empty. */
export function parseCollectionDetailResponse(payload: unknown): LiveCollectionDetailSnapshot {
  if (!isRecord(payload) || payload.source !== 'opensea' || !isRecord(payload.collection) || typeof payload.fetchedAt !== 'number' || !Number.isFinite(payload.fetchedAt)) {
    throw new CollectionDetailError('malformed', 'Unexpected payload shape')
  }
  const r = payload.collection
  const slug = text(r.slug)
  const name = text(r.name)
  const openseaUrl = httpsUrl(r.openseaUrl)
  if (!slug || !name || !openseaUrl) throw new CollectionDetailError('malformed', 'Missing collection identity')
  const chain = text(r.chain)
  const owner = text(r.owner)
  const links = isRecord(r.links) ? r.links : {}
  const handle = (v: unknown) => { const t = text(v); return t && USERNAME_RE.test(t) ? t : null }
  const tw = handle(links.twitterUsername)
  const ig = handle(links.instagramUsername)
  const created = text(r.createdDate)
  const safelist = text(r.safelistStatus)
  const unavailable = Array.isArray(payload.unavailable) ? payload.unavailable.filter((x): x is DetailSection => x === 'stats' || x === 'traits' || x === 'items') : []
  return {
    fetchedAt: payload.fetchedAt,
    partial: payload.partial === true,
    unavailable,
    collection: {
      slug, name, openseaUrl,
      description: text(r.description),
      cover: httpsUrl(r.imageUrl), banner: httpsUrl(r.bannerUrl),
      category: text(r.category),
      networkId: chain && NETWORKS.includes(chain as NetworkId) ? (chain as NetworkId) : null,
      creator: owner ? shortOwner(owner) : null,
      ownerAddress: owner,
      floor: amount(r.floor, false), volume24h: amount(r.volume24h, true),
      items: posInt(r.items), owners: posInt(r.owners),
      sales24h: count(r.sales24h),
      createdDate: created && !Number.isNaN(Date.parse(created)) ? created : null,
      verified: safelist ? safelist === 'verified' : null,
      contracts: Array.isArray(r.contracts)
        ? r.contracts.flatMap((c) => {
            const address = isRecord(c) ? text(c.address) : null
            const net = isRecord(c) ? text(c.chain) : null
            return address ? [{ address, networkId: net && NETWORKS.includes(net as NetworkId) ? (net as NetworkId) : null }] : []
          }).slice(0, 5)
        : [],
      fees: Array.isArray(r.fees)
        ? r.fees.flatMap((f) => (isRecord(f) && count(f.fee) !== null ? [{ fee: f.fee as number, required: f.required === true, recipient: text(f.recipient) }] : [])).slice(0, 5)
        : [],
      links: {
        projectUrl: httpsUrl(links.projectUrl), wikiUrl: httpsUrl(links.wikiUrl),
        discordUrl: httpsUrl(links.discordUrl), telegramUrl: httpsUrl(links.telegramUrl),
        twitterUrl: tw ? `https://x.com/${tw}` : null, instagramUrl: ig ? `https://www.instagram.com/${ig}` : null,
      },
      stats: parseStats(r.stats),
      traits: parseTraits(r.traits),
      sampleItems: Array.isArray(r.sampleItems)
        ? r.sampleItems.flatMap((i) => (isRecord(i) && text(i.identifier) ? [{ identifier: i.identifier as string, name: text(i.name), image: httpsUrl(i.imageUrl) }] : [])).slice(0, 8)
        : [],
    },
  }
}

export interface FetchCollectionDetailOptions {
  signal?: AbortSignal
  forceRefresh?: boolean
  endpoint?: string
  fetchImpl?: typeof fetch
  now?: () => number
}

const cache = new Map<string, { value: LiveCollectionDetailSnapshot; expiresAt: number }>()
const inFlight = new Map<string, Promise<LiveCollectionDetailSnapshot>>()

async function request(slug: string, opts: FetchCollectionDetailOptions): Promise<LiveCollectionDetailSnapshot> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await (opts.fetchImpl ?? fetch)(`${opts.endpoint ?? '/api/collection'}?slug=${encodeURIComponent(slug)}`, { headers: { accept: 'application/json' }, signal: controller.signal })
    } catch {
      throw new CollectionDetailError(timedOut ? 'timeout' : 'network', 'Request failed')
    }
    const isJson = (res.headers.get('content-type') ?? '').includes('json')
    let body: unknown = null
    if (isJson) { try { body = await res.json() } catch { throw new CollectionDetailError('malformed', 'Invalid JSON') } }
    if (!res.ok) {
      const code = isRecord(body) ? body.error : undefined
      if (code === 'not-configured' || code === 'upstream-auth' || code === 'not-found' || code === 'invalid-slug') throw new CollectionDetailError(code, String(code))
      if (res.status === 429 || code === 'rate-limited') throw new CollectionDetailError('rate-limited', 'HTTP 429')
      if (!isJson && res.status === 404) throw new CollectionDetailError('proxy-missing', 'HTTP 404')
      throw new CollectionDetailError('http', `HTTP ${res.status}`)
    }
    // A dev server / SPA host answers unknown paths with index.html (200, text/html): that means "no proxy here".
    if (!isJson) throw new CollectionDetailError('proxy-missing', 'Non-JSON response')
    return parseCollectionDetailResponse(body)
  } finally {
    clearTimeout(timer)
  }
}

function waitFor<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new CollectionDetailError('aborted', 'Request aborted'))
    if (signal.aborted) return onAbort()
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (v) => { signal.removeEventListener('abort', onAbort); resolve(v) },
      (e: unknown) => { signal.removeEventListener('abort', onAbort); reject(e) },
    )
  })
}

/** Fetch (or serve from the 5-minute cache) one live collection by its OpenSea slug. Concurrent callers share a request. */
export async function fetchLiveCollection(rawSlug: string, opts: FetchCollectionDetailOptions = {}): Promise<LiveCollectionDetailSnapshot> {
  const slug = rawSlug.trim().toLowerCase()
  if (!SLUG_RE.test(slug)) throw new CollectionDetailError('invalid-slug', 'Invalid slug')
  const now = opts.now ?? Date.now
  const hit = cache.get(slug)
  if (!opts.forceRefresh && hit && now() < hit.expiresAt) return hit.value
  if (opts.signal?.aborted) throw new CollectionDetailError('aborted', 'Request aborted')
  let pending = inFlight.get(slug)
  if (!pending) {
    pending = request(slug, opts)
      .then((snap) => { cache.set(slug, { value: snap, expiresAt: now() + (snap.partial ? 60_000 : CACHE_MS) }); return snap })
      .finally(() => { inFlight.delete(slug) })
    inFlight.set(slug, pending)
  }
  return waitFor(pending, opts.signal)
}

/** Test helper. */
export function resetCollectionDetailClientCache(): void { cache.clear(); inFlight.clear() }
