/**
 * Typed client for the collection detail page's paged data: NFT items (`/api/collection-items`) and recent
 * activity (`/api/collection-activity`). Both are served by server-side proxies, so the browser never sees an API
 * key. Payloads are validated field by field; anything missing becomes `null` and renders as "—".
 */
import { CollectionDetailError } from './collection-detail.ts'
import type { Amount } from './types.ts'

export interface LiveItem { identifier: string; name: string | null; image: string | null; contract: string | null }
export interface ItemsPage {
  slug: string
  items: LiveItem[]
  /** Opaque cursor for the following page, or null on the last page. */
  next: string | null
  /** identifier → cheapest active listing price. Covers only the items OpenSea's best-listings response included. */
  listings: Record<string, Amount>
  /** identifier → most recent sale price within OpenSea's latest-sales window. Not every item has one. */
  lastSales: Record<string, Amount>
  /** Optional price lookups whose upstream request failed (first page only). */
  unavailable: ('listings' | 'sales')[]
  fetchedAt: number
}

export type ActivityType = 'sale' | 'listing' | 'transfer'
export interface ActivityEvent {
  id: string
  type: ActivityType
  timestamp: number | null
  identifier: string | null
  name: string | null
  image: string | null
  price: Amount | null
  quantity: number | null
  from: string | null
  to: string | null
}
export interface ActivityPage { slug: string; type: ActivityType; events: ActivityEvent[]; next: string | null; fetchedAt: number }

const ITEMS_ENDPOINT = '/api/collection-items'
const ACTIVITY_ENDPOINT = '/api/collection-activity'
const CACHE_MS = 2 * 60_000
const TIMEOUT_MS = 15_000
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,99}$/i

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
function httpsUrl(v: unknown): string | null {
  const s = text(v)
  if (!s) return null
  try { return new URL(s).protocol === 'https:' ? s : null } catch { return null }
}
function price(v: unknown): Amount | null {
  if (!isRecord(v)) return null
  const symbol = text(v.symbol)
  return typeof v.value === 'number' && Number.isFinite(v.value) && v.value > 0 && symbol ? { value: v.value, symbol } : null
}
function priceMap(v: unknown): Record<string, Amount> {
  const out: Record<string, Amount> = {}
  if (!isRecord(v)) return out
  for (const [id, p] of Object.entries(v)) { const a = price(p); if (a) out[id] = a }
  return out
}
const cursor = (v: unknown): string | null => text(v)

export function parseItemsResponse(payload: unknown): ItemsPage {
  if (!isRecord(payload) || payload.source !== 'opensea' || !Array.isArray(payload.items) || typeof payload.fetchedAt !== 'number') {
    throw new CollectionDetailError('malformed', 'Unexpected payload shape')
  }
  const slug = text(payload.slug)
  if (!slug) throw new CollectionDetailError('malformed', 'Missing slug')
  const items: LiveItem[] = []
  const seen = new Set<string>()
  for (const i of payload.items) {
    const identifier = isRecord(i) ? text(i.identifier) : null
    if (!isRecord(i) || !identifier || seen.has(identifier)) continue
    seen.add(identifier)
    items.push({ identifier, name: text(i.name), image: httpsUrl(i.imageUrl), contract: text(i.contract) })
  }
  const unavailable = Array.isArray(payload.unavailable) ? payload.unavailable.filter((x): x is 'listings' | 'sales' => x === 'listings' || x === 'sales') : []
  return { slug, items, next: cursor(payload.next), listings: priceMap(payload.listings), lastSales: priceMap(payload.lastSales), unavailable, fetchedAt: payload.fetchedAt }
}

export function parseActivityResponse(payload: unknown): ActivityPage {
  if (!isRecord(payload) || payload.source !== 'opensea' || !Array.isArray(payload.events) || typeof payload.fetchedAt !== 'number') {
    throw new CollectionDetailError('malformed', 'Unexpected payload shape')
  }
  const slug = text(payload.slug)
  const type = payload.type
  if (!slug || (type !== 'sale' && type !== 'listing' && type !== 'transfer')) throw new CollectionDetailError('malformed', 'Missing slug or type')
  const events: ActivityEvent[] = []
  const seen = new Set<string>()
  for (const e of payload.events) {
    if (!isRecord(e)) continue
    const id = text(e.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    events.push({
      id, type,
      timestamp: typeof e.timestamp === 'number' && Number.isFinite(e.timestamp) && e.timestamp > 0 ? e.timestamp : null,
      identifier: text(e.identifier), name: text(e.name), image: httpsUrl(e.imageUrl),
      price: price(e.price),
      quantity: typeof e.quantity === 'number' && Number.isFinite(e.quantity) && e.quantity > 0 ? e.quantity : null,
      from: text(e.from), to: text(e.to),
    })
  }
  return { slug, type, events, next: cursor(payload.next), fetchedAt: payload.fetchedAt }
}

export interface FetchPageOptions {
  signal?: AbortSignal
  forceRefresh?: boolean
  /** Opaque cursor from the previous page. */
  next?: string | null
  endpoint?: string
  fetchImpl?: typeof fetch
  now?: () => number
}

const cache = new Map<string, { value: unknown; expiresAt: number }>()
const inFlight = new Map<string, Promise<unknown>>()

async function requestJson(url: string, opts: FetchPageOptions): Promise<unknown> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await (opts.fetchImpl ?? fetch)(url, { headers: { accept: 'application/json' }, signal: controller.signal })
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
    return body
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

/** Shared cache + in-flight dedupe; a caller's AbortSignal only stops that caller from waiting. */
async function cached<T>(url: string, parse: (payload: unknown) => T, opts: FetchPageOptions): Promise<T> {
  const now = opts.now ?? Date.now
  const hit = cache.get(url)
  if (!opts.forceRefresh && hit && now() < hit.expiresAt) return hit.value as T
  if (opts.signal?.aborted) throw new CollectionDetailError('aborted', 'Request aborted')
  let pending = inFlight.get(url) as Promise<T> | undefined
  if (!pending) {
    pending = requestJson(url, opts)
      .then((body) => {
        const value = parse(body)
        // A page with a failed optional lookup is cached only briefly so a retry can fill it in.
        const partial = ((value as { unavailable?: unknown[] }).unavailable?.length ?? 0) > 0
        cache.set(url, { value, expiresAt: now() + (partial ? 30_000 : CACHE_MS) })
        return value
      })
      .finally(() => { inFlight.delete(url) })
    inFlight.set(url, pending)
  }
  return waitFor(pending, opts.signal)
}

function build(endpoint: string, params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  return `${endpoint}?${q.toString()}`
}

function checkSlug(raw: string): string {
  const slug = raw.trim().toLowerCase()
  if (!SLUG_RE.test(slug)) throw new CollectionDetailError('invalid-slug', 'Invalid slug')
  return slug
}

export async function fetchItemsPage(rawSlug: string, opts: FetchPageOptions = {}): Promise<ItemsPage> {
  const slug = checkSlug(rawSlug)
  return cached(build(opts.endpoint ?? ITEMS_ENDPOINT, { slug, next: opts.next }), parseItemsResponse, opts)
}

export async function fetchActivityPage(rawSlug: string, type: ActivityType, opts: FetchPageOptions = {}): Promise<ActivityPage> {
  const slug = checkSlug(rawSlug)
  return cached(build(opts.endpoint ?? ACTIVITY_ENDPOINT, { slug, type, next: opts.next }), parseActivityResponse, opts)
}

/** Test helper. */
export function resetExtrasClientCache(): void { cache.clear(); inFlight.clear() }

/** The price shown on an item tile: an active listing if OpenSea supplied one, else the latest known sale. */
export function itemPrice(item: LiveItem, listings: Record<string, Amount>, lastSales: Record<string, Amount>): { kind: 'listed' | 'sold'; amount: Amount } | null {
  const listed = listings[item.identifier]
  if (listed) return { kind: 'listed', amount: listed }
  const sold = lastSales[item.identifier]
  return sold ? { kind: 'sold', amount: sold } : null
}

/**
 * Orders loaded items by displayed price within the dominant currency only (values in different currencies are not
 * comparable). Items with no price, or priced in another currency, keep their original order after the sorted ones.
 */
export function sortItemsByPrice(items: LiveItem[], listings: Record<string, Amount>, lastSales: Record<string, Amount>, dir: 'asc' | 'desc'): LiveItem[] {
  const priced = items.map((item) => ({ item, p: itemPrice(item, listings, lastSales)?.amount ?? null }))
  const tally = new Map<string, number>()
  for (const { p } of priced) if (p) tally.set(p.symbol, (tally.get(p.symbol) ?? 0) + 1)
  const dominant = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const comparable = priced.filter((x) => x.p !== null && x.p.symbol === dominant)
  const rest = priced.filter((x) => x.p === null || x.p.symbol !== dominant)
  comparable.sort((a, b) => (dir === 'asc' ? (a.p as Amount).value - (b.p as Amount).value : (b.p as Amount).value - (a.p as Amount).value))
  return [...comparable, ...rest].map((x) => x.item)
}

export interface DepthBucket { label: string; count: number }
/**
 * Distribution of the cheapest active listings relative to the lowest one in the sample (same currency only).
 * Returns null when fewer than 3 comparable listings exist — a histogram of one or two bars says nothing.
 */
export function listingDepth(listings: Record<string, Amount>): { symbol: string; total: number; buckets: DepthBucket[] } | null {
  const all = Object.values(listings)
  const tally = new Map<string, number>()
  for (const a of all) tally.set(a.symbol, (tally.get(a.symbol) ?? 0) + 1)
  const symbol = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!symbol) return null
  const values = all.filter((a) => a.symbol === symbol).map((a) => a.value)
  if (values.length < 3) return null
  const min = Math.min(...values)
  const edges = [1.05, 1.1, 1.25, 1.5, 2]
  const labels = ['≤1.05×', '≤1.10×', '≤1.25×', '≤1.50×', '≤2.00×', '>2.00×']
  const counts = labels.map(() => 0)
  for (const v of values) {
    const ratio = v / min
    const idx = edges.findIndex((e) => ratio <= e)
    counts[idx === -1 ? edges.length : idx] += 1
  }
  return { symbol, total: values.length, buckets: labels.map((label, i) => ({ label, count: counts[i] })) }
}
