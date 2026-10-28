/**
 * GET /api/collection-items?slug=<opensea-slug>[&next=<cursor>]
 *
 * A page of NFTs for one collection (OpenSea `GET /collection/{slug}/nfts`). On the first page only, two best-effort
 * lookups add real prices for the items that happen to appear in them:
 *   - cheapest active listings  (`GET /listings/collection/{slug}/best`)  → `listings`  (identifier → listed price)
 *   - most recent sales         (`GET /events/collection/{slug}?event_type=sale`) → `lastSales` (identifier → sale price)
 * Nothing is estimated: an item with no match simply has no price. A failed optional lookup is reported in
 * `unavailable` instead of failing the page.
 */
import { env } from 'node:process'
import { CURSOR_RE, SLUG_RE, TtlCache, errorResponse, fromBaseUnits, httpsUrl, isRecord, jsonResponse, openseaGet, optional, ProxyError, text, type ProxyOptions } from './_opensea-live.ts'

const PAGE_SIZE = 24
const FIRST_PAGE_LOOKUP = 50
const TTL_MS = 2 * 60_000
const IDENT_RE = /^[A-Za-z0-9_.-]{1,100}$/

export interface ProxyItem { identifier: string; name: string | null; imageUrl: string | null; contract: string | null }
export interface ProxyPrice { value: number; symbol: string }
export interface ProxyItemsPayload {
  source: 'opensea'
  slug: string
  items: ProxyItem[]
  next: string | null
  listings: Record<string, ProxyPrice>
  lastSales: Record<string, ProxyPrice>
  unavailable: ('listings' | 'sales')[]
  fetchedAt: number
}

const cache = new TtlCache<ProxyItemsPayload>()
export function resetItemsCache(): void { cache.clear() }

export function parseNfts(payload: unknown): { items: ProxyItem[]; next: string | null } {
  if (!isRecord(payload) || !Array.isArray(payload.nfts)) throw new ProxyError('malformed')
  const items: ProxyItem[] = []
  const seen = new Set<string>()
  for (const n of payload.nfts) {
    if (!isRecord(n) || n.is_disabled === true || n.is_nsfw === true) continue
    const identifier = text(n.identifier)
    if (!identifier || !IDENT_RE.test(identifier) || seen.has(identifier)) continue
    seen.add(identifier)
    items.push({ identifier, name: text(n.name), imageUrl: httpsUrl(n.display_image_url) ?? httpsUrl(n.image_url), contract: text(n.contract) })
  }
  const next = text(payload.next)
  return { items, next: next && CURSOR_RE.test(next) ? next : null }
}

/** Listing price lives at `price.current` as { currency, decimals, value } (value in base units). */
export function parseBestListings(payload: unknown): Record<string, ProxyPrice> {
  const out: Record<string, ProxyPrice> = {}
  if (!isRecord(payload) || !Array.isArray(payload.listings)) return out
  for (const l of payload.listings) {
    if (!isRecord(l)) continue
    const cur = isRecord(l.price) && isRecord(l.price.current) ? l.price.current : null
    const params = isRecord(l.protocol_data) && isRecord(l.protocol_data.parameters) ? l.protocol_data.parameters : null
    const offer = params && Array.isArray(params.offer) && isRecord(params.offer[0]) ? params.offer[0] : null
    const identifier = offer ? text(offer.identifierOrCriteria) : null
    const symbol = cur ? text(cur.currency) : null
    const value = cur ? fromBaseUnits(cur.value, cur.decimals) : null
    if (!identifier || !IDENT_RE.test(identifier) || !symbol || value === null || value <= 0 || identifier in out) continue
    out[identifier] = { value, symbol }
  }
  return out
}

/** Sale events are newest first, so the first sighting of an identifier is its most recent sale in the window. */
export function parseSales(payload: unknown): Record<string, ProxyPrice> {
  const out: Record<string, ProxyPrice> = {}
  if (!isRecord(payload) || !Array.isArray(payload.asset_events)) return out
  for (const e of payload.asset_events) {
    if (!isRecord(e) || e.event_type !== 'sale') continue
    const nft = isRecord(e.nft) ? e.nft : null
    const pay = isRecord(e.payment) ? e.payment : null
    const identifier = nft ? text(nft.identifier) : null
    const symbol = pay ? text(pay.symbol) : null
    const value = pay ? fromBaseUnits(pay.quantity, pay.decimals) : null
    if (!identifier || !IDENT_RE.test(identifier) || !symbol || value === null || value <= 0 || identifier in out) continue
    out[identifier] = { value, symbol }
  }
  return out
}

export async function handleCollectionItems(request: Request, opts: ProxyOptions = {}): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method-not-allowed' }, 405)
  const params = new URL(request.url).searchParams
  const slug = (params.get('slug') ?? '').trim().toLowerCase()
  const cursor = params.get('next') ?? undefined
  if (!SLUG_RE.test(slug)) return jsonResponse({ error: 'invalid-slug' }, 400)
  if (cursor !== undefined && !CURSOR_RE.test(cursor)) return jsonResponse({ error: 'invalid-cursor' }, 400)
  const now = (opts.now ?? Date.now)()
  const key = `${slug}|${cursor ?? ''}`
  const hit = cache.get(key, now)
  if (hit) return jsonResponse(hit, 200, 60)

  try {
    const first = cursor === undefined
    const [nfts, listings, sales] = await Promise.all([
      openseaGet(`/collection/${slug}/nfts`, { limit: PAGE_SIZE, next: cursor }, opts),
      first ? optional(openseaGet(`/listings/collection/${slug}/best`, { limit: FIRST_PAGE_LOOKUP }, opts)) : Promise.resolve(undefined),
      first ? optional(openseaGet(`/events/collection/${slug}`, { event_type: 'sale', limit: FIRST_PAGE_LOOKUP }, opts)) : Promise.resolve(undefined),
    ])
    const page = parseNfts(nfts)
    const unavailable: ProxyItemsPayload['unavailable'] = []
    if (first && listings === null) unavailable.push('listings')
    if (first && sales === null) unavailable.push('sales')
    const body: ProxyItemsPayload = {
      source: 'opensea', slug, items: page.items, next: page.next,
      listings: listings ? parseBestListings(listings) : {},
      lastSales: sales ? parseSales(sales) : {},
      unavailable, fetchedAt: now,
    }
    cache.set(key, body, now + (unavailable.length ? 30_000 : TTL_MS))
    return jsonResponse(body, 200, unavailable.length ? 0 : 60)
  } catch (e) {
    return errorResponse(e)
  }
}

/** Vercel function entry (Web-standard handler). The key comes from the server environment only. */
export function GET(request: Request): Promise<Response> {
  return handleCollectionItems(request, { apiKey: env.OPENSEA_API_KEY })
}
