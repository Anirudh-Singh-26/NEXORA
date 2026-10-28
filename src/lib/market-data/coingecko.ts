/**
 * Typed, read-only market-data service backed by CoinGecko's public (keyless) API.
 *
 * - No API key is used or accepted: nothing secret ever ships in the frontend bundle.
 * - One request fetches every mapped token (`/coins/markets`, `ids=` list, max 250), cached for
 *   `CACHE_MS` and de-duplicated while in flight, to stay well inside the keyless rate limit.
 * - Values are never invented: a token with a missing/null price, market cap, volume or 24h change
 *   is reported as unavailable instead of being filled in.
 *
 * Optional, non-secret config: `VITE_MARKET_API_BASE_URL` points at your own proxy/mirror of the
 * CoinGecko `/api/v3` surface (use this if the browser is blocked by CORS or rate limits).
 */
import type { Token } from '../../data/types.ts'
import { BoundedCache } from '../blockchain/cache.ts'

export const MARKET_SOURCE = { name: 'CoinGecko', url: 'https://www.coingecko.com' } as const
export const DEFAULT_BASE_URL = 'https://api.coingecko.com/api/v3'
const CACHE_MS = 60_000
const TIMEOUT_MS = 10_000
const SPARKLINE_POINTS = 28

/** NEXORA token id → CoinGecko coin id. Tokens absent here (NEX, RND) are fictional and have no live market. */
export const COINGECKO_IDS: Readonly<Record<string, string>> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  sol: 'solana',
  arb: 'arbitrum',
  avax: 'avalanche-2',
  pol: 'polygon-ecosystem-token',
  link: 'chainlink',
  uni: 'uniswap',
  aave: 'aave',
  op: 'optimism',
  tia: 'celestia',
  sui: 'sui',
  usdc: 'usd-coin',
  jup: 'jupiter-exchange-solana',
  bonk: 'bonk',
  gmx: 'gmx',
  wbtc: 'wrapped-bitcoin',
  render: 'render-token',
  zora: 'zora',
  gala: 'gala',
}

export type MarketErrorKind = 'timeout' | 'rate-limited' | 'network' | 'http' | 'malformed' | 'aborted'

export class MarketDataError extends Error {
  kind: MarketErrorKind
  constructor(kind: MarketErrorKind, message: string) {
    super(message)
    this.name = 'MarketDataError'
    this.kind = kind
  }
}

export function marketErrorMessage(kind: MarketErrorKind): string {
  switch (kind) {
    case 'timeout': return 'The market-data provider took too long to respond.'
    case 'rate-limited': return 'The public market-data API is rate limiting requests. Try again in a minute.'
    case 'network': return 'Could not reach the market-data provider. This can also be a browser CORS restriction.'
    case 'http': return 'The market-data provider returned an error.'
    case 'malformed': return 'The market-data provider returned an unreadable response.'
    case 'aborted': return 'The request was cancelled.'
  }
}

/** Live figures for one token. Every number is finite; sparkline may be empty if the provider sent none. */
export interface TokenQuote {
  price: number
  change24h: number
  marketCap: number
  volume24h: number
  sparkline: number[]
  /** Epoch ms of the provider's own `last_updated` for this coin, or null if absent/unparseable. */
  providerUpdatedAt: number | null
}

export interface MarketSnapshot {
  quotes: Readonly<Record<string, TokenQuote>>
  /** NEXORA token ids that were requested but returned no complete quote. */
  unavailableIds: string[]
  /** Epoch ms when the response was received (not when read from cache). */
  fetchedAt: number
  source: typeof MARKET_SOURCE.name
}

export interface FetchOptions {
  signal?: AbortSignal
  forceRefresh?: boolean
  baseUrl?: string
  fetchImpl?: typeof fetch
  now?: () => number
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function downsample(points: number[], target: number): number[] {
  if (points.length <= target) return points
  const out: number[] = []
  for (let i = 0; i < target; i++) out.push(points[Math.round((i * (points.length - 1)) / (target - 1))])
  return out
}

function parseSparkline(v: unknown): number[] {
  if (!isRecord(v) || !Array.isArray(v.price)) return []
  const pts = v.price.filter(finite)
  return pts.length >= 2 ? downsample(pts, SPARKLINE_POINTS) : []
}

/** Pure parser: validates the provider payload and maps it to NEXORA ids. Exported for tests. */
export function parseMarkets(payload: unknown, fetchedAt: number): MarketSnapshot {
  if (!Array.isArray(payload)) throw new MarketDataError('malformed', 'Expected an array')
  const byProviderId = new Map<string, Record<string, unknown>>()
  for (const row of payload) if (isRecord(row) && typeof row.id === 'string') byProviderId.set(row.id, row)

  const quotes: Record<string, TokenQuote> = {}
  const unavailableIds: string[] = []
  for (const [id, providerId] of Object.entries(COINGECKO_IDS)) {
    const r = byProviderId.get(providerId)
    if (!r || !finite(r.current_price) || !finite(r.market_cap) || !finite(r.total_volume) || !finite(r.price_change_percentage_24h)) {
      unavailableIds.push(id)
      continue
    }
    const updated = typeof r.last_updated === 'string' ? Date.parse(r.last_updated) : NaN
    quotes[id] = {
      price: r.current_price,
      change24h: r.price_change_percentage_24h,
      marketCap: r.market_cap,
      volume24h: r.total_volume,
      sparkline: parseSparkline(r.sparkline_in_7d),
      providerUpdatedAt: Number.isNaN(updated) ? null : updated,
    }
  }
  if (Object.keys(quotes).length === 0) throw new MarketDataError('malformed', 'No usable quotes in response')
  return { quotes, unavailableIds, fetchedAt, source: MARKET_SOURCE.name }
}

const cache = new BoundedCache<MarketSnapshot>(1)
let inFlight: Promise<MarketSnapshot> | null = null

function envBaseUrl(): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  const v = env?.VITE_MARKET_API_BASE_URL?.trim()
  return v ? v.replace(/\/+$/, '') : undefined
}

async function request(opts: FetchOptions, now: () => number): Promise<MarketSnapshot> {
  const base = opts.baseUrl ?? envBaseUrl() ?? DEFAULT_BASE_URL
  const params = new URLSearchParams({
    vs_currency: 'usd',
    ids: Object.values(COINGECKO_IDS).join(','),
    order: 'market_cap_desc',
    per_page: String(Object.keys(COINGECKO_IDS).length),
    page: '1',
    sparkline: 'true',
    price_change_percentage: '24h',
  })
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await (opts.fetchImpl ?? fetch)(`${base}/coins/markets?${params}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })
    } catch {
      if (timedOut) throw new MarketDataError('timeout', 'Request timed out')
      throw new MarketDataError('network', 'Network request failed')
    }
    if (res.status === 429) throw new MarketDataError('rate-limited', 'HTTP 429')
    if (!res.ok) throw new MarketDataError('http', `HTTP ${res.status}`)
    let body: unknown
    try { body = await res.json() } catch { throw new MarketDataError('malformed', 'Invalid JSON') }
    return parseMarkets(body, now())
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Let one caller stop *waiting* without cancelling the shared request. The underlying fetch is owned by the
 * service (it has its own timeout) because other callers, e.g. React StrictMode's second effect run, may still need it.
 */
function waitFor<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new MarketDataError('aborted', 'Request aborted'))
    if (signal.aborted) return onAbort()
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (v) => { signal.removeEventListener('abort', onAbort); resolve(v) },
      (e: unknown) => { signal.removeEventListener('abort', onAbort); reject(e) },
    )
  })
}

/** Fetch (or serve from the 60s cache) the market snapshot. Concurrent callers share one request. */
export async function fetchMarketSnapshot(opts: FetchOptions = {}): Promise<MarketSnapshot> {
  const now = opts.now ?? Date.now
  if (!opts.forceRefresh) {
    const hit = cache.get('markets', now())
    if (hit) return hit.value
  }
  if (opts.signal?.aborted) throw new MarketDataError('aborted', 'Request aborted')
  if (!inFlight) {
    inFlight = request(opts, now)
      .then((snap) => { cache.set('markets', snap, now(), CACHE_MS); return snap })
      .finally(() => { inFlight = null })
  }
  return waitFor(inFlight, opts.signal)
}

/**
 * Overlay live quotes on catalogue tokens. Only tokens with a complete live quote are returned;
 * fictional/unmapped tokens and tokens the provider omitted go to `excluded` (never given made-up figures).
 * Catalogue metadata (name, network, description, flags) is kept; the demo note is dropped on live rows.
 */
export function applyQuotes(catalogTokens: Token[], snapshot: MarketSnapshot): { live: Token[]; excluded: Token[] } {
  const live: Token[] = []
  const excluded: Token[] = []
  for (const t of catalogTokens) {
    const q = snapshot.quotes[t.id]
    if (!q) { excluded.push(t); continue }
    const { demoNote: _demo, ...rest } = t
    live.push({ ...rest, price: q.price, change24h: q.change24h, marketCap: q.marketCap, volume24h: q.volume24h, sparkline: q.sparkline })
  }
  return { live, excluded }
}
