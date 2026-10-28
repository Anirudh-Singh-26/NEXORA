/**
 * GET /api/collection-activity?slug=<opensea-slug>&type=sale|listing|transfer[&next=<cursor>]
 *
 * A page of recent collection events (OpenSea `GET /events/collection/{slug}`), newest first. Prices are converted from
 * the event's own payment token and decimals; events without a usable payment have `price: null`.
 */
import { env } from 'node:process'
import { CURSOR_RE, SLUG_RE, TtlCache, errorResponse, fromBaseUnits, httpsUrl, isRecord, jsonResponse, openseaGet, ProxyError, text, type ProxyOptions } from './_opensea-live.ts'

const PAGE_SIZE = 20
const TTL_MS = 60_000
const IDENT_RE = /^[A-Za-z0-9_.-]{1,100}$/
export const ACTIVITY_TYPES = ['sale', 'listing', 'transfer'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export interface ProxyEvent {
  id: string
  type: ActivityType
  /** Epoch milliseconds. */
  timestamp: number | null
  identifier: string | null
  name: string | null
  imageUrl: string | null
  price: { value: number; symbol: string } | null
  quantity: number | null
  from: string | null
  to: string | null
}
export interface ProxyActivityPayload { source: 'opensea'; slug: string; type: ActivityType; events: ProxyEvent[]; next: string | null; fetchedAt: number }

const cache = new TtlCache<ProxyActivityPayload>()
export function resetActivityCache(): void { cache.clear() }

const address = (v: unknown): string | null => {
  const s = text(v)
  return s && s.length <= 100 && /^[A-Za-z0-9._-]+$/.test(s) ? s : null
}

export function parseEvents(payload: unknown, type: ActivityType): { events: ProxyEvent[]; next: string | null } {
  if (!isRecord(payload) || !Array.isArray(payload.asset_events)) throw new ProxyError('malformed')
  const events: ProxyEvent[] = []
  payload.asset_events.forEach((e, index) => {
    if (!isRecord(e)) return
    const nft = isRecord(e.nft) ? e.nft : isRecord(e.asset) ? e.asset : null
    const pay = isRecord(e.payment) ? e.payment : null
    const ts = [e.event_timestamp, e.closing_date, e.start_date].find((t) => typeof t === 'number' && Number.isFinite(t) && t > 0) as number | undefined
    const identifier = nft ? text(nft.identifier) : null
    const value = pay ? fromBaseUnits(pay.quantity, pay.decimals) : null
    const symbol = pay ? text(pay.symbol) : null
    const quantity = typeof e.quantity === 'number' && e.quantity > 0 ? e.quantity : null
    const tx = text(e.transaction) ?? text(e.order_hash) ?? 'event'
    events.push({
      id: `${tx}:${identifier ?? ''}:${ts ?? ''}:${index}`,
      type,
      timestamp: ts === undefined ? null : ts * 1000,
      identifier: identifier && IDENT_RE.test(identifier) ? identifier : null,
      name: nft ? text(nft.name) : null,
      imageUrl: nft ? httpsUrl(nft.display_image_url) ?? httpsUrl(nft.image_url) : null,
      price: value !== null && value > 0 && symbol ? { value, symbol } : null,
      quantity,
      from: address(type === 'sale' ? e.seller : type === 'transfer' ? e.from_address : e.maker),
      to: address(type === 'sale' ? e.buyer : type === 'transfer' ? e.to_address : null),
    })
  })
  const next = text(payload.next)
  return { events, next: next && CURSOR_RE.test(next) ? next : null }
}

export async function handleCollectionActivity(request: Request, opts: ProxyOptions = {}): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method-not-allowed' }, 405)
  const params = new URL(request.url).searchParams
  const slug = (params.get('slug') ?? '').trim().toLowerCase()
  const type = (params.get('type') ?? 'sale') as ActivityType
  const cursor = params.get('next') ?? undefined
  if (!SLUG_RE.test(slug)) return jsonResponse({ error: 'invalid-slug' }, 400)
  if (!ACTIVITY_TYPES.includes(type)) return jsonResponse({ error: 'invalid-type' }, 400)
  if (cursor !== undefined && !CURSOR_RE.test(cursor)) return jsonResponse({ error: 'invalid-cursor' }, 400)
  const now = (opts.now ?? Date.now)()
  const key = `${slug}|${type}|${cursor ?? ''}`
  const hit = cache.get(key, now)
  if (hit) return jsonResponse(hit, 200, 30)

  try {
    const raw = await openseaGet(`/events/collection/${slug}`, { event_type: type, limit: PAGE_SIZE, next: cursor }, opts)
    const page = parseEvents(raw, type)
    const body: ProxyActivityPayload = { source: 'opensea', slug, type, events: page.events, next: page.next, fetchedAt: now }
    cache.set(key, body, now + TTL_MS)
    return jsonResponse(body, 200, 30)
  } catch (e) {
    return errorResponse(e)
  }
}

/** Vercel function entry (Web-standard handler). The key comes from the server environment only. */
export function GET(request: Request): Promise<Response> {
  return handleCollectionActivity(request, { apiKey: env.OPENSEA_API_KEY })
}
