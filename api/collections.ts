/**
 * Server-side proxy for NEXORA's Collections page (Vercel Function; also mounted by vite.config.ts in `npm run dev`).
 *
 * Why it exists: OpenSea's API requires an API key. A key placed in browser code (or any VITE_* variable) is public,
 * so the key lives only in the server environment variable OPENSEA_API_KEY and the browser talks to this endpoint.
 *
 * It is deliberately NOT an open relay: GET only, no client-supplied upstream paths or parameters, a fixed bounded set
 * of upstream calls (1 list + 2 per collection), a small concurrency limit, and a response cache.
 *
 * Upstream endpoints (https://docs.opensea.io):
 *   GET /api/v2/collections/top           - ranked collection metadata (no stats in the payload)
 *   GET /api/v2/collections/{slug}/stats  - floor price, interval volume, owners
 *   GET /api/v2/collections/{slug}        - total_supply
 */

import { env } from 'node:process'
export interface Amount { value: number; symbol: string }
export interface LiveCollectionDto {
  rank: number
  slug: string
  name: string
  description: string | null
  imageUrl: string | null
  bannerUrl: string | null
  category: string | null
  chain: string
  owner: string | null
  openseaUrl: string
  floor: Amount | null
  volume24h: Amount | null
  items: number | null
  owners: number | null
}
export interface CollectionsApiResponse {
  source: 'opensea'
  /** Epoch ms when the upstream data was assembled (not when this response was served from a cache). */
  fetchedAt: number
  /** True when some per-collection statistics could not be fetched; those fields are null. */
  partial: boolean
  collections: LiveCollectionDto[]
}
export type ApiErrorCode = 'method-not-allowed' | 'not-configured' | 'upstream-auth' | 'rate-limited' | 'upstream'

export const OPENSEA_BASE = 'https://api.opensea.io/api/v2'
/** Chains NEXORA has network entries for. OpenSea chain identifiers match NEXORA network ids. */
export const SUPPORTED_CHAINS = ['ethereum', 'solana', 'base', 'polygon', 'arbitrum', 'avalanche', 'optimism'] as const
export const COLLECTION_LIMIT = 20
const CONCURRENCY = 4
const UPSTREAM_TIMEOUT_MS = 8_000
const CACHE_FULL_MS = 15 * 60_000
const CACHE_PARTIAL_MS = 2 * 60_000

class UpstreamError extends Error {
  code: ApiErrorCode
  constructor(code: ApiErrorCode) { super(code); this.code = code }
}

type Json = Record<string, unknown>
const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const httpsUrl = (v: unknown): string | null => {
  const s = str(v)
  if (!s) return null
  try { return new URL(s).protocol === 'https:' ? s : null } catch { return null }
}

interface Deps { apiKey: string; fetchImpl: typeof fetch }

async function getJson(path: string, deps: Deps): Promise<{ status: number; body: unknown }> {
  let res: Response
  try {
    res = await deps.fetchImpl(`${OPENSEA_BASE}${path}`, {
      headers: { accept: 'application/json', 'x-api-key': deps.apiKey },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    throw new UpstreamError('upstream')
  }
  let body: unknown = null
  try { body = await res.json() } catch { /* non-JSON error bodies are handled by status */ }
  return { status: res.status, body }
}

/** Pure parser for one /collections/{slug}/stats payload. Missing/sentinel values become null, never zero. */
export function parseStats(body: unknown): { floor: Amount | null; volume24h: Amount | null; owners: number | null } | null {
  if (!isRecord(body) || !isRecord(body.total)) return null
  const t = body.total
  const price = num(t.floor_price)
  const sym = str(t.floor_price_symbol)
  const floor = price !== null && price > 0 && sym ? { value: price, symbol: sym } : null // 0 / empty symbol = no listing
  const day = Array.isArray(body.intervals) ? body.intervals.find((i): i is Json => isRecord(i) && i.interval === 'one_day') : undefined
  const dv = day ? num(day.volume) : null
  const ds = day ? str(day.volume_symbol) : null
  const volume24h = dv !== null && dv >= 0 && ds ? { value: dv, symbol: ds } : null
  const o = num(t.num_owners)
  return { floor, volume24h, owners: o !== null && o > 0 ? o : null }
}

/** Pure parser for the `collections` array of /collections/top. Drops disabled, NSFW and unsupported-chain rows. */
export function parseTop(body: unknown): Omit<LiveCollectionDto, 'rank' | 'floor' | 'volume24h' | 'items' | 'owners'>[] {
  if (!isRecord(body) || !Array.isArray(body.collections)) throw new UpstreamError('upstream')
  const out: ReturnType<typeof parseTop> = []
  const seen = new Set<string>()
  for (const r of body.collections) {
    if (!isRecord(r)) continue
    const slug = str(r.collection)
    const name = str(r.name)
    const openseaUrl = httpsUrl(r.opensea_url)
    if (!slug || !name || !openseaUrl || seen.has(slug) || r.is_disabled === true || r.is_nsfw === true) continue
    const chain = Array.isArray(r.contracts)
      ? r.contracts.map((c) => (isRecord(c) ? str(c.chain) : null)).find((c): c is string => c !== null && (SUPPORTED_CHAINS as readonly string[]).includes(c))
      : undefined
    if (!chain) continue
    seen.add(slug)
    out.push({
      slug, name, openseaUrl, chain,
      description: str(r.description), imageUrl: httpsUrl(r.image_url), bannerUrl: httpsUrl(r.banner_image_url),
      category: str(r.category), owner: str(r.owner),
    })
  }
  return out
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i]) }
  }))
  return results
}

export async function buildCollections(deps: Deps, now: () => number = Date.now): Promise<CollectionsApiResponse> {
  const top = await getJson(`/collections/top?sort_by=one_day_volume&limit=${COLLECTION_LIMIT}&chains=${SUPPORTED_CHAINS.join(',')}`, deps)
  if (top.status === 401 || top.status === 403) throw new UpstreamError('upstream-auth')
  if (top.status === 429) throw new UpstreamError('rate-limited')
  if (top.status !== 200) throw new UpstreamError('upstream')
  const base = parseTop(top.body)

  let partial = false
  let limited = false // once OpenSea says 429, stop spending requests this round
  const enriched = await mapPool(base, CONCURRENCY, async (row) => {
    if (limited) { partial = true; return { stats: null, items: null } }
    const slug = encodeURIComponent(row.slug)
    const [s, d] = await Promise.allSettled([getJson(`/collections/${slug}/stats`, deps), getJson(`/collections/${slug}`, deps)])
    let stats: ReturnType<typeof parseStats> = null
    let items: number | null = null
    if (s.status === 'fulfilled' && s.value.status === 200) stats = parseStats(s.value.body)
    if (d.status === 'fulfilled' && d.value.status === 200 && isRecord(d.value.body)) {
      const n = num(d.value.body.total_supply)
      items = n !== null && n > 0 ? n : null
    }
    for (const r of [s, d]) if (r.status === 'fulfilled' && r.value.status === 429) limited = true
    if (!stats || items === null) partial = true
    return { stats, items }
  })

  return {
    source: 'opensea',
    fetchedAt: now(),
    partial,
    collections: base.map((row, i) => ({
      rank: i + 1, ...row,
      floor: enriched[i].stats?.floor ?? null,
      volume24h: enriched[i].stats?.volume24h ?? null,
      owners: enriched[i].stats?.owners ?? null,
      items: enriched[i].items,
    })),
  }
}

const STATUS: Record<ApiErrorCode, number> = {
  'method-not-allowed': 405, 'not-configured': 503, 'upstream-auth': 502, 'rate-limited': 429, upstream: 502,
}
const json = (body: unknown, status: number, cache: string) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } })
const failure = (code: ApiErrorCode) => json({ error: code }, STATUS[code], 'no-store')

let memo: { value: CollectionsApiResponse; expiresAt: number } | null = null
let inFlight: Promise<CollectionsApiResponse> | null = null

/** Framework-agnostic handler (used by the Vercel function below and the Vite dev middleware). */
export async function handleCollections(
  request: Request,
  env: { apiKey?: string; fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<Response> {
  if (request.method !== 'GET') return failure('method-not-allowed')
  const apiKey = env.apiKey?.trim()
  if (!apiKey) return failure('not-configured')
  const now = env.now ?? Date.now
  if (memo && now() < memo.expiresAt) return json(memo.value, 200, 'public, s-maxage=900, stale-while-revalidate=3600')
  try {
    inFlight ??= buildCollections({ apiKey, fetchImpl: env.fetchImpl ?? fetch }, now).finally(() => { inFlight = null })
    const value = await inFlight
    memo = { value, expiresAt: now() + (value.partial ? CACHE_PARTIAL_MS : CACHE_FULL_MS) }
    return json(value, 200, value.partial ? 'public, s-maxage=120' : 'public, s-maxage=900, stale-while-revalidate=3600')
  } catch (e) {
    return failure(e instanceof UpstreamError ? e.code : 'upstream')
  }
}

/** Test helper: forget the in-memory cache. */
export function resetCollectionsCache(): void { memo = null; inFlight = null }

/** Vercel Function entry point (Web Standard handler). */
export function GET(request: Request): Promise<Response> {
  return handleCollections(request, { apiKey: env.OPENSEA_API_KEY })
}
