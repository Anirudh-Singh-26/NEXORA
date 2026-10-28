/**
 * Shared helpers for the collection items / activity proxies (api/collection-items.ts, api/collection-activity.ts).
 *
 * The OpenSea key is read only on the server (process.env.OPENSEA_API_KEY, or passed in by the dev middleware in
 * vite.config.ts) and goes only into the `x-api-key` request header. It is never placed in a response body.
 * Files starting with `_` are not exposed as Vercel functions.
 */
export const OPENSEA_BASE = 'https://api.opensea.io/api/v2'

export interface ProxyOptions {
  apiKey?: string
  fetchImpl?: typeof fetch
  now?: () => number
}

export type ProxyErrorKind = 'not-configured' | 'upstream-auth' | 'not-found' | 'rate-limited' | 'timeout' | 'network' | 'http' | 'malformed'

export class ProxyError extends Error {
  kind: ProxyErrorKind
  constructor(kind: ProxyErrorKind, message: string = kind) { super(message); this.name = 'ProxyError'; this.kind = kind }
}

const STATUS: Record<ProxyErrorKind, number> = {
  'not-configured': 503, 'upstream-auth': 502, 'not-found': 404, 'rate-limited': 429, timeout: 504, network: 502, http: 502, malformed: 502,
}

export const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,99}$/i
/** OpenSea pagination cursors are opaque base64-ish strings; anything else is rejected before it reaches upstream. */
export const CURSOR_RE = /^[A-Za-z0-9_\-=.%+/]{1,600}$/
const UPSTREAM_TIMEOUT_MS = 12_000

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
export function httpsUrl(v: unknown): string | null {
  const s = text(v)
  if (!s) return null
  try { return new URL(s).protocol === 'https:' ? s : null } catch { return null }
}

/** Integer base units (decimal string) → number in whole units, without losing the integer part to float rounding. */
export function fromBaseUnits(raw: unknown, decimals: unknown): number | null {
  const s = typeof raw === 'number' && Number.isSafeInteger(raw) ? String(raw) : typeof raw === 'string' ? raw : null
  if (s === null || !/^\d{1,60}$/.test(s)) return null
  if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null
  const big = BigInt(s)
  const base = 10n ** BigInt(decimals)
  const whole = big / base
  const frac = (big % base).toString().padStart(decimals, '0')
  const n = Number(decimals === 0 ? whole.toString() : `${whole}.${frac}`)
  return Number.isFinite(n) ? n : null
}

/** GET one OpenSea v2 path with the server-side key. Throws ProxyError with a coarse, key-free kind. */
export async function openseaGet(path: string, params: Record<string, string | number | undefined>, opts: ProxyOptions): Promise<unknown> {
  if (!opts.apiKey) throw new ProxyError('not-configured')
  const url = new URL(`${OPENSEA_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  let res: Response
  try {
    res = await (opts.fetchImpl ?? fetch)(url.toString(), { headers: { accept: 'application/json', 'x-api-key': opts.apiKey }, signal: controller.signal })
  } catch (e) {
    throw new ProxyError(controller.signal.aborted ? 'timeout' : 'network', e instanceof Error ? e.name : 'network')
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 401 || res.status === 403) throw new ProxyError('upstream-auth')
  if (res.status === 404) throw new ProxyError('not-found')
  if (res.status === 429) throw new ProxyError('rate-limited')
  if (!res.ok) throw new ProxyError('http', `HTTP ${res.status}`)
  try { return await res.json() } catch { throw new ProxyError('malformed') }
}

export function jsonResponse(body: unknown, status = 200, cacheSeconds = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 && cacheSeconds > 0 ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 3}` : 'no-store',
    },
  })
}

export function errorResponse(e: unknown): Response {
  const kind: ProxyErrorKind = e instanceof ProxyError ? e.kind : 'http'
  return jsonResponse({ error: kind }, STATUS[kind])
}

/** Tiny TTL cache so repeated views / load-more of the same page do not spend upstream rate limit. */
export class TtlCache<T> {
  private map = new Map<string, { value: T; expiresAt: number }>()
  private max: number
  constructor(max = 200) { this.max = max }
  get(key: string, now: number): T | undefined {
    const hit = this.map.get(key)
    if (!hit) return undefined
    if (now >= hit.expiresAt) { this.map.delete(key); return undefined }
    return hit.value
  }
  set(key: string, value: T, expiresAt: number): void {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value as string)
    this.map.set(key, { value, expiresAt })
  }
  clear(): void { this.map.clear() }
}

/** Best-effort wrapper: resolves to null instead of throwing, except auth/config errors which must surface. */
export async function optional<T>(p: Promise<T>): Promise<T | null> {
  try { return await p } catch (e) {
    if (e instanceof ProxyError && (e.kind === 'not-configured' || e.kind === 'upstream-auth')) throw e
    return null
  }
}
