/**
 * Typed client for NEXORA's `/api/collections` proxy, which fronts the OpenSea API v2 (see api/collections.ts).
 * The browser never sees an API key. Responses are validated field by field; anything missing becomes `null`.
 * The shared request is owned by this module (not by any caller's AbortSignal) so React effect cleanup or
 * StrictMode re-runs can never cancel a request another caller is still waiting on.
 */
import type { Collection, CollectionCategory, NetworkId } from '../../data/types.ts'
import type { Amount, CollectionsErrorKind, ListedCollection, LiveCollectionsSnapshot } from './types.ts'

export const COLLECTIONS_SOURCE = { name: 'OpenSea', url: 'https://opensea.io' } as const
const DEFAULT_ENDPOINT = '/api/collections'
const CACHE_MS = 5 * 60_000
const TIMEOUT_MS = 25_000 // a cold proxy fill makes ~40 upstream calls

export class CollectionsError extends Error {
  kind: CollectionsErrorKind
  constructor(kind: CollectionsErrorKind, message: string) { super(message); this.name = 'CollectionsError'; this.kind = kind }
}

export function collectionsErrorMessage(kind: CollectionsErrorKind): string {
  switch (kind) {
    case 'not-configured': return 'The collections proxy has no OPENSEA_API_KEY configured on the server.'
    case 'upstream-auth': return 'OpenSea rejected the server’s API key. It may be invalid or expired (free instant keys expire after 7 days).'
    case 'proxy-missing': return 'The /api/collections proxy is not reachable. Run the app with `npm run dev` or deploy it to Vercel with OPENSEA_API_KEY set.'
    case 'rate-limited': return 'OpenSea is rate limiting the proxy. Try again in a few minutes.'
    case 'timeout': return 'The collections proxy took too long to respond.'
    case 'network': return 'Could not reach the collections proxy.'
    case 'http': return 'The collections proxy returned an error.'
    case 'malformed': return 'The collections proxy returned an unreadable response.'
    case 'aborted': return 'The request was cancelled.'
  }
}

const NETWORKS: readonly NetworkId[] = ['ethereum', 'solana', 'base', 'polygon', 'arbitrum', 'avalanche', 'optimism']

/**
 * OpenSea category → NEXORA category. These are approximations; anything without a sensible match
 * (music, domain-names, virtual-worlds, sports…) stays `null` and is only reachable under "All".
 */
const CATEGORY_MAP: Readonly<Record<string, CollectionCategory>> = {
  art: 'art', gaming: 'gaming', photography: 'photography', memberships: 'membership', pfps: 'identity', 'domain-names': 'identity',
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const posInt = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

function httpsUrl(v: unknown): string | null {
  const s = text(v)
  if (!s) return null
  try { return new URL(s).protocol === 'https:' ? s : null } catch { return null }
}

function amount(v: unknown, allowZero: boolean): Amount | null {
  if (!isRecord(v)) return null
  const value = v.value
  const symbol = text(v.symbol)
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (!allowZero && value === 0) || !symbol) return null
  return { value, symbol }
}

/** `0x1234…abcd` for long hex addresses; other owner strings are shown as-is. */
export function shortOwner(owner: string): string {
  return /^0x[0-9a-fA-F]{40}$/.test(owner) ? `${owner.slice(0, 6)}…${owner.slice(-4)}` : owner
}

/** Pure parser for the proxy payload. Invalid rows are dropped; an unusable payload throws `malformed`. */
export function parseCollectionsResponse(payload: unknown): LiveCollectionsSnapshot {
  if (!isRecord(payload) || payload.source !== 'opensea' || !Array.isArray(payload.collections) || typeof payload.fetchedAt !== 'number' || !Number.isFinite(payload.fetchedAt)) {
    throw new CollectionsError('malformed', 'Unexpected payload shape')
  }
  const collections: ListedCollection[] = []
  const seen = new Set<string>()
  for (const r of payload.collections) {
    if (!isRecord(r)) continue
    const slug = text(r.slug)
    const name = text(r.name)
    const url = httpsUrl(r.openseaUrl)
    const chain = text(r.chain)
    if (!slug || !name || !url || !chain || seen.has(slug) || !NETWORKS.includes(chain as NetworkId)) continue
    seen.add(slug)
    const owner = text(r.owner)
    const rawCategory = text(r.category)
    collections.push({
      id: `opensea:${slug}`, slug, name, networkId: chain as NetworkId,
      category: rawCategory ? CATEGORY_MAP[rawCategory] ?? null : null,
      creator: owner ? shortOwner(owner) : null,
      description: text(r.description),
      cover: httpsUrl(r.imageUrl), banner: httpsUrl(r.bannerUrl),
      floor: amount(r.floor, false), volume24h: amount(r.volume24h, true),
      items: posInt(r.items), owners: posInt(r.owners),
      preview: [], rank: typeof r.rank === 'number' ? r.rank : collections.length + 1,
      source: 'live', externalUrl: url,
    })
  }
  if (collections.length === 0) throw new CollectionsError('malformed', 'No usable collections')
  return { collections, fetchedAt: payload.fetchedAt, partial: payload.partial === true }
}

/** Adapt a demo catalogue record to the page's nullable shape. Demo values stay labelled as demo by the page. */
export function fromDemoCollection(c: Collection): ListedCollection {
  return {
    id: c.id, slug: c.slug, name: c.name, networkId: c.networkId, category: c.category, creator: c.creator,
    description: c.description, cover: c.cover, banner: c.banner,
    floor: { value: c.floor, symbol: c.floorSymbol }, volume24h: { value: c.volume24h, symbol: '' },
    items: c.items, owners: c.owners, preview: c.nfts.slice(0, 3).map((n) => n.image), source: 'demo',
  }
}

export interface FetchCollectionsOptions {
  signal?: AbortSignal
  forceRefresh?: boolean
  endpoint?: string
  fetchImpl?: typeof fetch
  now?: () => number
}

let cache: { value: LiveCollectionsSnapshot; expiresAt: number } | null = null
let inFlight: Promise<LiveCollectionsSnapshot> | null = null

function envEndpoint(): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  return env?.VITE_COLLECTIONS_API_URL?.trim() || undefined
}

async function request(opts: FetchCollectionsOptions): Promise<LiveCollectionsSnapshot> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await (opts.fetchImpl ?? fetch)(opts.endpoint ?? envEndpoint() ?? DEFAULT_ENDPOINT, { headers: { accept: 'application/json' }, signal: controller.signal })
    } catch {
      throw new CollectionsError(timedOut ? 'timeout' : 'network', 'Request failed')
    }
    const isJson = (res.headers.get('content-type') ?? '').includes('json')
    let body: unknown = null
    if (isJson) { try { body = await res.json() } catch { throw new CollectionsError('malformed', 'Invalid JSON') } }
    if (!res.ok) {
      const code = isRecord(body) ? body.error : undefined
      if (code === 'not-configured' || code === 'upstream-auth') throw new CollectionsError(code, String(code))
      if (res.status === 429 || code === 'rate-limited') throw new CollectionsError('rate-limited', 'HTTP 429')
      if (!isJson && res.status === 404) throw new CollectionsError('proxy-missing', 'HTTP 404')
      throw new CollectionsError('http', `HTTP ${res.status}`)
    }
    // A dev server / SPA host answers unknown paths with index.html (200, text/html): that means "no proxy here".
    if (!isJson) throw new CollectionsError('proxy-missing', 'Non-JSON response')
    return parseCollectionsResponse(body)
  } finally {
    clearTimeout(timer)
  }
}

function waitFor<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new CollectionsError('aborted', 'Request aborted'))
    if (signal.aborted) return onAbort()
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (v) => { signal.removeEventListener('abort', onAbort); resolve(v) },
      (e: unknown) => { signal.removeEventListener('abort', onAbort); reject(e) },
    )
  })
}

/** Fetch (or serve from the 5-minute cache) the live collections snapshot. Concurrent callers share one request. */
export async function fetchLiveCollections(opts: FetchCollectionsOptions = {}): Promise<LiveCollectionsSnapshot> {
  const now = opts.now ?? Date.now
  if (!opts.forceRefresh && cache && now() < cache.expiresAt) return cache.value
  if (opts.signal?.aborted) throw new CollectionsError('aborted', 'Request aborted')
  inFlight ??= request(opts)
    .then((snap) => { cache = { value: snap, expiresAt: now() + (snap.partial ? 60_000 : CACHE_MS) }; return snap })
    .finally(() => { inFlight = null })
  return waitFor(inFlight, opts.signal)
}

/** Test helper. */
export function resetCollectionsClientCache(): void { cache = null; inFlight = null }
