/**
 * Single-collection proxy: GET /api/collection?slug=<opensea-collection-slug>
 *
 * Fronts four OpenSea API v2 calls, made in parallel and cached 5 minutes per slug:
 *   /collections/{slug}        identity, contracts, links, fees, supply
 *   /collections/{slug}/stats  floor, all-time totals and one_day / seven_day / thirty_day intervals
 *   /traits/{slug}             collection-wide trait categories and per-value item counts
 *   /collection/{slug}/nfts    a small page (8) of the collection's items (OpenSea does not rank or price them)
 * Only the first call is required; the other three are best-effort and reported in `unavailable` when they fail. The API key is read
 * only on the server (OPENSEA_API_KEY, no VITE_ prefix), is sent only upstream in the `x-api-key` header, and
 * never appears in a response. Works as a Vercel function (`GET` export) and, via vite.config.ts, in `npm run dev`.
 */

const UPSTREAM = 'https://api.opensea.io/api/v2'
const TTL_MS = 5 * 60_000
const PARTIAL_TTL_MS = 60_000
const TIMEOUT_MS = 12_000
const MAX_CACHE = 200
/** OpenSea slugs are lowercase letters, digits, hyphens and underscores; reject anything else before it reaches a URL. */
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,99}$/i

/** OpenSea chain id → NEXORA network id. Unknown chains are reported as null, never guessed. */
const CHAINS: Readonly<Record<string, string>> = {
  ethereum: 'ethereum', solana: 'solana', base: 'base', matic: 'polygon', polygon: 'polygon',
  arbitrum: 'arbitrum', avalanche: 'avalanche', optimism: 'optimism',
}

export interface AmountDto { value: number; symbol: string }
export interface IntervalStatsDto {
  volume: AmountDto | null
  /** Absolute volume difference vs the previous interval, as reported by OpenSea. */
  volumeDiff: AmountDto | null
  sales: number | null
  salesDiff: number | null
  averagePrice: AmountDto | null
}
export interface StatsDto {
  totalVolume: AmountDto | null
  totalSales: number | null
  averagePrice: AmountDto | null
  marketCap: AmountDto | null
  intervals: { oneDay: IntervalStatsDto | null; sevenDay: IntervalStatsDto | null; thirtyDay: IntervalStatsDto | null }
}
export interface ContractDto { address: string; chain: string | null }
export interface FeeDto { fee: number; required: boolean; recipient: string | null }
export interface LinksDto {
  projectUrl: string | null; wikiUrl: string | null; discordUrl: string | null; telegramUrl: string | null
  twitterUsername: string | null; instagramUsername: string | null
}
export interface TraitCategoryDto { name: string; type: string | null; distinctValues: number; values: { value: string; count: number }[] }
export interface TraitsDto { totalCategories: number; categories: TraitCategoryDto[] }
export interface ItemDto { identifier: string; name: string | null; imageUrl: string | null }
export type OptionalSection = 'stats' | 'traits' | 'items'

export interface CollectionDetailDto {
  slug: string
  name: string
  description: string | null
  imageUrl: string | null
  bannerUrl: string | null
  category: string | null
  chain: string | null
  owner: string | null
  openseaUrl: string
  floor: AmountDto | null
  volume24h: AmountDto | null
  items: number | null
  owners: number | null
  sales24h: number | null
  createdDate: string | null
  safelistStatus: string | null
  contracts: ContractDto[]
  fees: FeeDto[]
  links: LinksDto
  stats: StatsDto | null
  traits: TraitsDto | null
  sampleItems: ItemDto[]
}
export interface CollectionDetailResponse { source: 'opensea'; fetchedAt: number; partial: boolean; unavailable: OptionalSection[]; collection: CollectionDetailDto }

export interface HandlerOptions { apiKey: string | undefined; fetchImpl?: typeof fetch; now?: () => number }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const posInt = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
function httpsUrl(v: unknown): string | null {
  const s = text(v)
  if (!s) return null
  try { return new URL(s).protocol === 'https:' ? s : null } catch { return null }
}

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const money = (value: unknown, symbol: string | null, allowZero = true): AmountDto | null => {
  const n = finite(value)
  return n !== null && n >= 0 && (allowZero || n > 0) && symbol ? { value: n, symbol } : null
}
/** Signed amount (a difference can be negative). */
const signed = (value: unknown, symbol: string | null): AmountDto | null => {
  const n = finite(value)
  return n !== null && symbol ? { value: n, symbol } : null
}
const count = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)

function parseInterval(v: unknown, fallbackSymbol: string | null): IntervalStatsDto | null {
  if (!isRecord(v)) return null
  const sym = text(v.volume_symbol) ?? fallbackSymbol
  const out: IntervalStatsDto = {
    volume: money(v.volume, sym), volumeDiff: signed(v.volume_diff, sym),
    sales: count(v.sales), salesDiff: finite(v.sales_diff), averagePrice: money(v.average_price, sym),
  }
  return Object.values(out).every((x) => x === null) ? null : out
}

/**
 * Pure: pull floor, 24h volume and owners (kept for the listing-compatible fields) plus all-time totals and the
 * per-interval figures from an OpenSea stats payload. A figure without a usable unit, or a zero floor, becomes null.
 * Assumptions to confirm on a real response: `average_price` shares the volume currency; `market_cap` shares the
 * floor currency unless the payload names its own `market_cap_symbol`.
 */
export function parseDetailStats(payload: unknown): { floor: AmountDto | null; volume24h: AmountDto | null; owners: number | null; sales24h: number | null; stats: StatsDto } | null {
  if (!isRecord(payload)) return null
  const total = isRecord(payload.total) ? payload.total : {}
  const floorSymbol = text(total.floor_price_symbol)
  const totalSymbol = text(total.volume_symbol)
  const intervals = Array.isArray(payload.intervals) ? payload.intervals : []
  const find = (name: string) => intervals.find((i) => isRecord(i) && i.interval === name)
  const oneDay = parseInterval(find('one_day'), totalSymbol)
  return {
    floor: money(total.floor_price, floorSymbol, false),
    volume24h: oneDay?.volume ?? null,
    owners: posInt(total.num_owners),
    sales24h: oneDay?.sales ?? null,
    stats: {
      totalVolume: money(total.volume, totalSymbol),
      totalSales: count(total.sales),
      averagePrice: money(total.average_price, text(total.average_price_symbol) ?? totalSymbol),
      marketCap: money(total.market_cap, text(total.market_cap_symbol) ?? floorSymbol),
      intervals: { oneDay, sevenDay: parseInterval(find('seven_day'), totalSymbol), thirtyDay: parseInterval(find('thirty_day'), totalSymbol) },
    },
  }
}

const MAX_CATEGORIES = 12
const MAX_VALUES = 6
const MAX_ITEMS = 8

/** Pure: `/traits/{slug}` → capped, sorted collection-wide distribution. null when nothing usable. */
export function parseTraits(payload: unknown): TraitsDto | null {
  if (!isRecord(payload) || !isRecord(payload.counts)) return null
  const types = isRecord(payload.categories) ? payload.categories : {}
  const all: TraitCategoryDto[] = []
  for (const [name, raw] of Object.entries(payload.counts)) {
    if (!isRecord(raw)) continue
    const values = Object.entries(raw).flatMap(([value, n]) => (count(n) !== null && value.trim() ? [{ value, count: n as number }] : []))
    if (values.length === 0) continue
    values.sort((a, b) => b.count - a.count)
    all.push({ name, type: text(types[name]), distinctValues: values.length, values: values.slice(0, MAX_VALUES) })
  }
  return all.length ? { totalCategories: all.length, categories: all.slice(0, MAX_CATEGORIES) } : null
}

/** Pure: `/collection/{slug}/nfts` → a few displayable items (disabled/NSFW dropped). Order is OpenSea's, not a ranking. */
export function parseItems(payload: unknown): ItemDto[] {
  if (!isRecord(payload) || !Array.isArray(payload.nfts)) return []
  const out: ItemDto[] = []
  for (const n of payload.nfts) {
    if (!isRecord(n) || n.is_disabled === true || n.is_nsfw === true) continue
    const identifier = text(n.identifier)
    if (!identifier) continue
    out.push({ identifier, name: text(n.name), imageUrl: httpsUrl(n.image_url) })
    if (out.length >= MAX_ITEMS) break
  }
  return out
}

const USERNAME_RE = /^[A-Za-z0-9_.]{1,40}$/
const username = (v: unknown): string | null => { const t = text(v); return t && USERNAME_RE.test(t) ? t : null }

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } })

const cache = new Map<string, { value: CollectionDetailResponse; expiresAt: number }>()
export function resetCollectionCache(): void { cache.clear() }

class UpstreamError extends Error {
  status: number
  constructor(status: number) { super(`upstream ${status}`); this.status = status }
}

async function upstream(path: string, o: HandlerOptions): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await (o.fetchImpl ?? fetch)(`${UPSTREAM}${path}`, { headers: { accept: 'application/json', 'x-api-key': o.apiKey ?? '' }, signal: controller.signal })
    if (!res.ok) throw new UpstreamError(res.status)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function handleCollection(request: Request, o: HandlerOptions): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method-not-allowed' }, 405, { allow: 'GET' })
  if (!o.apiKey) return json({ error: 'not-configured' }, 503)

  const slug = new URL(request.url).searchParams.get('slug')?.trim() ?? ''
  if (!SLUG_RE.test(slug)) return json({ error: 'invalid-slug' }, 400)
  const key = slug.toLowerCase()
  const now = (o.now ?? Date.now)()
  const hit = cache.get(key)
  if (hit && now < hit.expiresAt) return json(hit.value, 200, { 'cache-control': 'public, max-age=60, s-maxage=300' })

  let base: unknown
  try {
    base = await upstream(`/collections/${encodeURIComponent(key)}`, o)
  } catch (e) {
    if (e instanceof UpstreamError) {
      if (e.status === 404) return json({ error: 'not-found' }, 404)
      if (e.status === 401 || e.status === 403) return json({ error: 'upstream-auth' }, 502)
      if (e.status === 429) return json({ error: 'rate-limited' }, 429)
    }
    return json({ error: 'upstream-error' }, 502)
  }
  if (!isRecord(base)) return json({ error: 'upstream-error' }, 502)
  // Mirrors the listing, which hides disabled and NSFW collections.
  if (base.is_disabled === true || base.is_nsfw === true) return json({ error: 'not-found' }, 404)
  const name = text(base.name)
  const openseaUrl = httpsUrl(base.opensea_url)
  if (!name) return json({ error: 'not-found' }, 404)

  // Everything below is best-effort and fetched in parallel: a failing section becomes null/empty and is listed in
  // `unavailable`, so the page still renders the collection itself.
  const enc = encodeURIComponent(key)
  const [statsR, traitsR, itemsR] = await Promise.allSettled([
    upstream(`/collections/${enc}/stats`, o),
    upstream(`/traits/${enc}`, o),
    upstream(`/collection/${enc}/nfts?limit=${MAX_ITEMS}`, o),
  ])
  const unavailable: OptionalSection[] = []
  let stats: ReturnType<typeof parseDetailStats> = null
  if (statsR.status === 'fulfilled') stats = parseDetailStats(statsR.value)
  if (!stats) unavailable.push('stats')
  const traits = traitsR.status === 'fulfilled' ? parseTraits(traitsR.value) : null
  if (traitsR.status === 'rejected') unavailable.push('traits')
  const sampleItems = itemsR.status === 'fulfilled' ? parseItems(itemsR.value) : []
  if (itemsR.status === 'rejected') unavailable.push('items')
  const partial = unavailable.length > 0

  const contracts: ContractDto[] = Array.isArray(base.contracts)
    ? base.contracts.flatMap((c) => {
        const address = isRecord(c) ? text(c.address) : null
        if (!isRecord(c) || !address) return []
        const chain = text(c.chain)
        return [{ address, chain: chain ? CHAINS[chain.toLowerCase()] ?? null : null }]
      }).slice(0, 5)
    : []
  const fees: FeeDto[] = Array.isArray(base.fees)
    ? base.fees.flatMap((f) => {
        if (!isRecord(f)) return []
        const fee = finite(f.fee)
        return fee !== null && fee >= 0 ? [{ fee, required: f.required === true, recipient: text(f.recipient) }] : []
      }).slice(0, 5)
    : []
  const firstContract = Array.isArray(base.contracts) ? base.contracts.find(isRecord) : undefined
  const chainRaw = isRecord(firstContract) ? text(firstContract.chain) : null
  const created = text(base.created_date)
  const collection: CollectionDetailDto = {
    slug: key,
    name,
    description: text(base.description),
    imageUrl: httpsUrl(base.image_url),
    bannerUrl: httpsUrl(base.banner_image_url),
    category: text(base.category),
    chain: chainRaw ? CHAINS[chainRaw.toLowerCase()] ?? null : null,
    owner: text(base.owner),
    openseaUrl: openseaUrl ?? `https://opensea.io/collection/${enc}`,
    floor: stats?.floor ?? null,
    volume24h: stats?.volume24h ?? null,
    items: posInt(base.total_supply),
    owners: stats?.owners ?? null,
    sales24h: stats?.sales24h ?? null,
    createdDate: created && !Number.isNaN(Date.parse(created)) ? created : null,
    safelistStatus: text(base.safelist_status),
    contracts,
    fees,
    links: {
      projectUrl: httpsUrl(base.project_url), wikiUrl: httpsUrl(base.wiki_url),
      discordUrl: httpsUrl(base.discord_url), telegramUrl: httpsUrl(base.telegram_url),
      twitterUsername: username(base.twitter_username), instagramUsername: username(base.instagram_username),
    },
    stats: stats?.stats ?? null,
    traits,
    sampleItems,
  }
  const value: CollectionDetailResponse = { source: 'opensea', fetchedAt: now, partial, unavailable, collection }
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string)
  cache.set(key, { value, expiresAt: now + (partial ? PARTIAL_TTL_MS : TTL_MS) })
  return json(value, 200, { 'cache-control': partial ? 'no-store' : 'public, max-age=60, s-maxage=300' })
}

/** Vercel function entry (Web-standard signature). */
export function GET(request: Request): Promise<Response> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return handleCollection(request, { apiKey: env?.OPENSEA_API_KEY })
}
