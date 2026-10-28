import { WALLET_NETWORK_CONFIG } from '../src/lib/wallet/network-config.ts'
/**
 * GET /api/wallet-tokens?chainId=<id>&address=<0x…>[&pageKey=<cursor>]
 *
 * Read-only proxy for a wallet's ERC-20 balances using Alchemy's Token API (alchemy_getTokenBalances +
 * alchemy_getTokenMetadata). The API key (ALCHEMY_API_KEY, no VITE_ prefix) lives only in this server process and is
 * never sent to the browser, logged, or included in any response. Self-contained: it does not depend on the other api/ files.
 *
 * Responses: 200 { chainId, address, tokens[], nextPageKey, metadataPartial, provider } or
 *            { error: { code, message } } with an HTTP status. No URL or key ever appears in an error.
 */
import { ALCHEMY_NETWORKS, isWalletTokenChain } from '../src/lib/wallet-tokens/chains.ts'

/** One page of balances; Alchemy caps maxCount at 100. Kept at 50 so the metadata batch stays small. */
export const PAGE_SIZE = 50
const UPSTREAM_TIMEOUT_MS = 10_000
const METADATA_TTL_MS = 24 * 60 * 60 * 1000
const METADATA_CACHE_MAX = 2000

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const HEX_RE = /^0x[0-9a-fA-F]*$/
const PAGE_KEY_RE = /^[A-Za-z0-9_\-=:.+/]{1,1024}$/

export type ErrorCode = 'not-configured' | 'invalid-request' | 'method-not-allowed' | 'rate-limited' | 'provider-auth' | 'chain-unsupported' | 'upstream'

export interface TokenMetadata { name: string | null; symbol: string | null; decimals: number | null; logo: string | null }
export interface ProxyToken extends TokenMetadata { contract: string; rawBalance: string }

export interface HandlerOptions { apiKey?: string; fetchImpl?: typeof fetch; now?: () => number }

class ProxyError extends Error {
  code: ErrorCode
  status: number
  constructor(code: ErrorCode, status: number, message: string) { super(message); this.code = code; this.status = status }
}

const MESSAGES: Record<ErrorCode, string> = {
  'not-configured': 'The token data provider is not configured on the server (ALCHEMY_API_KEY is missing).',
  'invalid-request': 'The request was invalid.',
  'method-not-allowed': 'Only GET is supported.',
  'rate-limited': 'The token data provider is rate limiting requests. Try again shortly.',
  'provider-auth': 'The token data provider rejected the server credentials.',
  'chain-unsupported': 'The token data provider does not offer token balances for this network on the configured plan.',
  upstream: 'The token data provider is unavailable right now.',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    // Per-address data: never let a shared cache store or reuse it.
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  })
}

function failure(code: ErrorCode, status: number): Response {
  return json({ error: { code, message: MESSAGES[code] } }, status)
}

// ---- parsing (pure, exported for tests) ---------------------------------------------------------------------------

/** Keeps well-formed, non-zero, de-duplicated balances. Anything malformed or errored is dropped, never guessed. */
export function parseTokenBalances(body: unknown): { balances: Array<{ contract: string; rawBalance: string }>; pageKey: string | null } {
  const result = (body as { result?: unknown } | null)?.result as { tokenBalances?: unknown; pageKey?: unknown } | undefined
  if (!result || !Array.isArray(result.tokenBalances)) throw new ProxyError('upstream', 502, MESSAGES.upstream)
  const seen = new Set<string>()
  const balances: Array<{ contract: string; rawBalance: string }> = []
  for (const entry of result.tokenBalances as Array<Record<string, unknown>>) {
    if (!entry || typeof entry !== 'object') continue
    const contract = entry.contractAddress
    const hex = entry.tokenBalance
    if (typeof contract !== 'string' || !ADDRESS_RE.test(contract)) continue
    if (entry.error) continue
    if (typeof hex !== 'string' || !HEX_RE.test(hex) || hex.length <= 2) continue
    const raw = BigInt(hex)
    if (raw <= 0n) continue
    const key = contract.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    balances.push({ contract: key, rawBalance: raw.toString() })
  }
  const pageKey = typeof result.pageKey === 'string' && PAGE_KEY_RE.test(result.pageKey) ? result.pageKey : null
  return { balances, pageKey }
}

/** Token names/symbols are chosen by whoever deployed the contract: strip control characters and cap the length. */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim()
  return cleaned ? cleaned.slice(0, max) : null
}

export function parseTokenMetadata(result: unknown): TokenMetadata {
  const r = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>
  const decimals = typeof r.decimals === 'number' && Number.isInteger(r.decimals) && r.decimals >= 0 && r.decimals <= 36 ? r.decimals : null
  let logo: string | null = null
  if (typeof r.logo === 'string' && r.logo.length <= 2048) {
    try { const url = new URL(r.logo); if (url.protocol === 'https:' && !url.username && !url.password) logo = url.toString() } catch { /* not a URL */ }
  }
  return { name: cleanText(r.name, 64), symbol: cleanText(r.symbol, 24), decimals, logo }
}

// ---- upstream -----------------------------------------------------------------------------------------------------

const metadataCache = new Map<string, { value: TokenMetadata; expires: number }>()
export function resetWalletTokensCache(): void { metadataCache.clear() }

function rememberMetadata(key: string, value: TokenMetadata, expires: number): void {
  if (metadataCache.size >= METADATA_CACHE_MAX) {
    const oldest = metadataCache.keys().next().value
    if (oldest !== undefined) metadataCache.delete(oldest)
  }
  metadataCache.set(key, { value, expires })
}

async function post(fetchImpl: typeof fetch, url: string, body: unknown): Promise<{ status: number; body: unknown }> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    // The thrown error can mention the URL (which contains the key): never forward it.
    throw new ProxyError('upstream', 502, MESSAGES.upstream)
  }
  let parsed: unknown = null
  try { parsed = await response.json() } catch { /* non-JSON body */ }
  return { status: response.status, body: parsed }
}

function mapHttpStatus(status: number): ProxyError | null {
  if (status === 429) return new ProxyError('rate-limited', 429, MESSAGES['rate-limited'])
  if (status === 401 || status === 403) return new ProxyError('provider-auth', 502, MESSAGES['provider-auth'])
  if (status < 200 || status >= 300) return new ProxyError('upstream', 502, MESSAGES.upstream)
  return null
}

function mapRpcError(body: unknown): ProxyError | null {
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error
  if (!error) return null
  const code = typeof error.code === 'number' ? error.code : null
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : ''
  if (code === 429 || message.includes('rate limit') || message.includes('compute units')) return new ProxyError('rate-limited', 429, MESSAGES['rate-limited'])
  if (code === -32601 || message.includes('not supported') || message.includes('not enabled') || message.includes('not available')) return new ProxyError('chain-unsupported', 422, MESSAGES['chain-unsupported'])
  if (message.includes('invalid api key') || message.includes('unauthorized')) return new ProxyError('provider-auth', 502, MESSAGES['provider-auth'])
  return new ProxyError('upstream', 502, MESSAGES.upstream)
}

async function loadMetadata(
  fetchImpl: typeof fetch, url: string, chainId: number, contracts: string[], now: number,
): Promise<{ metadata: Map<string, TokenMetadata>; partial: boolean }> {
  const metadata = new Map<string, TokenMetadata>()
  const missing: string[] = []
  for (const contract of contracts) {
    const hit = metadataCache.get(`${chainId}:${contract}`)
    if (hit && hit.expires > now) metadata.set(contract, hit.value)
    else missing.push(contract)
  }
  if (missing.length === 0) return { metadata, partial: false }
  let partial = false
  try {
    const batch = missing.map((contract, index) => ({ jsonrpc: '2.0', id: index, method: 'alchemy_getTokenMetadata', params: [contract] }))
    const { status, body } = await post(fetchImpl, url, batch)
    if (mapHttpStatus(status) || !Array.isArray(body)) throw new ProxyError('upstream', 502, MESSAGES.upstream)
    for (const item of body as Array<{ id?: unknown; result?: unknown; error?: unknown }>) {
      const contract = typeof item?.id === 'number' ? missing[item.id] : undefined
      if (!contract) continue
      if (item.error || item.result == null) { partial = true; continue }
      const value = parseTokenMetadata(item.result)
      metadata.set(contract, value)
      rememberMetadata(`${chainId}:${contract}`, value, now + METADATA_TTL_MS)
    }
    if (missing.some((contract) => !metadata.has(contract))) partial = true
  } catch {
    // Balances are still valid without metadata. Failures are not cached, so the next request retries.
    partial = true
  }
  return { metadata, partial }
}

// ---- handler ------------------------------------------------------------------------------------------------------

export async function handleWalletTokens(request: Request, options: HandlerOptions = {}): Promise<Response> {
  if (request.method !== 'GET') return failure('method-not-allowed', 405)
  if (!options.apiKey) return failure('not-configured', 503)
  const params = new URL(request.url).searchParams
  const chainText = params.get('chainId') ?? ''
  const chainId = /^[0-9]{1,12}$/.test(chainText) ? Number(chainText) : NaN
  const address = params.get('address') ?? ''
  const pageKey = params.get('pageKey')
  if (!isWalletTokenChain(chainId) || !ADDRESS_RE.test(address) || (pageKey !== null && !PAGE_KEY_RE.test(pageKey))) return failure('invalid-request', 400)

  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args))
  const now = (options.now ?? Date.now)()
  const url = `https://${ALCHEMY_NETWORKS[chainId]}${WALLET_NETWORK_CONFIG.providers.alchemyTokenHostSuffix}/${encodeURIComponent(options.apiKey)}`
  const normalized = address.toLowerCase()

  try {
    const rpcOptions: Record<string, unknown> = { maxCount: PAGE_SIZE }
    if (pageKey) rpcOptions.pageKey = pageKey
    const { status, body } = await post(fetchImpl, url, { jsonrpc: '2.0', id: 1, method: 'alchemy_getTokenBalances', params: [normalized, 'erc20', rpcOptions] })
    const httpError = mapHttpStatus(status) ?? mapRpcError(body)
    if (httpError) throw httpError
    const { balances, pageKey: nextPageKey } = parseTokenBalances(body)
    const { metadata, partial } = await loadMetadata(fetchImpl, url, chainId, balances.map((item) => item.contract), now)
    const tokens: ProxyToken[] = balances.map((item) => ({
      contract: item.contract,
      rawBalance: item.rawBalance,
      ...(metadata.get(item.contract) ?? { name: null, symbol: null, decimals: null, logo: null }),
    }))
    return json({ chainId, address: normalized, tokens, nextPageKey, metadataPartial: partial, provider: 'alchemy' })
  } catch (cause) {
    if (cause instanceof ProxyError) return failure(cause.code, cause.status)
    return failure('upstream', 502)
  }
}

/** Vercel Function entry (Web-standard handler). Reads the key from the server environment only. */
export async function GET(request: Request): Promise<Response> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return handleWalletTokens(request, { apiKey: env?.ALCHEMY_API_KEY })
}
