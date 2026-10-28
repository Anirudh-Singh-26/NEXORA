/**
 * GET /api/solana-balance?address=<base58 public key>
 *
 * Read-only proxy for a wallet's native SOL balance: Alchemy's Solana Devnet JSON-RPC `getBalance`. The API key
 * (ALCHEMY_API_KEY, no VITE_ prefix) lives only in this server process and is never sent to the browser, logged, or
 * included in any response. No SPL tokens, no signing, no transactions.
 *
 * This endpoint targets Solana Devnet only. NEXORA does not serve Mainnet SOL balances.
 *
 * Provider order: Alchemy Solana Devnet (only when ALCHEMY_API_KEY is set AND that Alchemy app has the Solana Devnet
 * network enabled), then the public Devnet RPC (SOLANA_DEVNET_RPC_URL, no key). Alchemy answers 401/403 for a network
 * that is not enabled on the key's app, and any other Alchemy failure (rate limit, outage, timeout, unreadable answer) also
 * falls back to the public Devnet RPC instead of failing the request. With no key configured the public Devnet RPC is used directly. SOLANA_RPC_URL is never read.
 *
 * Responses: 200 { address, lamports (integer string), provider } or { error: { code, message } } with an HTTP status.
 * Error messages are fixed strings: no URL, key or raw provider text ever appears in them.
 */
import { isSolanaAddress } from '../src/lib/solana-balance/solana-balance.ts'
import { SOLANA_DEVNET_RPC_URL, solanaDevnetRpcUrl } from '../src/lib/network/testnet.ts'

const UPSTREAM_TIMEOUT_MS = 10_000
const MAX_LAMPORTS = 2n ** 64n - 1n

export type ErrorCode = 'not-configured' | 'invalid-request' | 'method-not-allowed' | 'rate-limited' | 'provider-auth' | 'upstream'

export interface HandlerOptions { apiKey?: string; fetchImpl?: typeof fetch }

class ProxyError extends Error {
  code: ErrorCode
  status: number
  constructor(code: ErrorCode, status: number) { super(code); this.code = code; this.status = status }
}

const MESSAGES: Record<ErrorCode, string> = {
  'not-configured': 'The balance data provider is not configured on the server (ALCHEMY_API_KEY is missing).',
  'invalid-request': 'The request was invalid.',
  'method-not-allowed': 'Only GET is supported.',
  'rate-limited': 'The balance data provider is rate limiting requests. Try again shortly.',
  'provider-auth': 'The balance data provider rejected the server credentials.',
  upstream: 'The balance data provider is unavailable right now.',
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

/**
 * Extracts lamports from a getBalance response as an exact integer string. Balances above 2^53 lose precision in
 * JSON.parse, so when the parsed number is not a safe integer the digits are read from the raw text instead.
 */
export function parseLamports(text: string): string {
  let body: { result?: { value?: unknown } } | null
  try { body = JSON.parse(text) as typeof body } catch { throw new ProxyError('upstream', 502) }
  const value = body?.result?.value
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !Number.isInteger(value)) throw new ProxyError('upstream', 502)
  let digits: string
  if (Number.isSafeInteger(value)) digits = String(value)
  else {
    // The getBalance envelope has exactly one "value" key (context only has slot/apiVersion); anything else is rejected.
    const matches = [...text.matchAll(/"value"\s*:\s*([0-9]{1,20})\s*[,}]/g)]
    if (matches.length !== 1) throw new ProxyError('upstream', 502)
    digits = matches[0][1]
  }
  if (BigInt(digits) > MAX_LAMPORTS) throw new ProxyError('upstream', 502)
  return BigInt(digits).toString()
}

function mapHttpStatus(status: number): ProxyError | null {
  if (status === 429) return new ProxyError('rate-limited', 429)
  if (status === 401 || status === 403) return new ProxyError('provider-auth', 502)
  if (status < 200 || status >= 300) return new ProxyError('upstream', 502)
  return null
}

function mapRpcError(text: string): ProxyError | null {
  let error: { code?: unknown; message?: unknown } | undefined
  try { error = (JSON.parse(text) as { error?: { code?: unknown; message?: unknown } } | null)?.error } catch { return null }
  if (!error) return null
  const code = typeof error.code === 'number' ? error.code : null
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : ''
  if (code === 429 || message.includes('rate limit') || message.includes('compute units') || message.includes('too many requests')) return new ProxyError('rate-limited', 429)
  if (message.includes('invalid api key') || message.includes('unauthorized')) return new ProxyError('provider-auth', 502)
  return new ProxyError('upstream', 502)
}

async function queryBalance(url: string, address: string, fetchImpl: typeof fetch): Promise<string> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address, { commitment: 'confirmed' }] }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    // The thrown error can mention the URL (which contains the key): never forward it.
    throw new ProxyError('upstream', 502)
  }
  const text = await response.text().catch(() => '')
  const httpError = mapHttpStatus(response.status) ?? mapRpcError(text)
  if (httpError) throw httpError
  return parseLamports(text)
}

export async function handleSolanaBalance(request: Request, options: HandlerOptions = {}): Promise<Response> {
  if (request.method !== 'GET') return failure('method-not-allowed', 405)
  const addresses = new URL(request.url).searchParams.getAll('address')
  const address = addresses[0] ?? ''
  if (addresses.length !== 1 || !isSolanaAddress(address)) return failure('invalid-request', 400)

  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args))
  const providers: Array<{ name: string; url: string }> = []
  if (options.apiKey) providers.push({ name: 'alchemy', url: solanaDevnetRpcUrl(options.apiKey) })
  providers.push({ name: 'solana-devnet-public', url: SOLANA_DEVNET_RPC_URL })

  let last: ProxyError = new ProxyError('upstream', 502)
  for (const provider of providers) {
    try {
      return json({ address, lamports: await queryBalance(provider.url, address, fetchImpl), provider: provider.name })
    } catch (cause) {
      last = cause instanceof ProxyError ? cause : new ProxyError('upstream', 502)
      // Any failure of one provider (rejected credential, disabled network, rate limit, outage, timeout, malformed answer)
      // moves on to the next one; only when every provider has failed is the LAST provider's classified error reported.
    }
  }
  return failure(last.code, last.status)
}

/** Vercel Function entry (Web-standard handler). Reads the key from the server environment only. */
export async function GET(request: Request): Promise<Response> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  try {
    return await handleSolanaBalance(request, { apiKey: env?.ALCHEMY_API_KEY })
  } catch (cause) {
    // Never let an unexpected exception become a bare platform 500: log only the error class (no message, URL or key).
    console.error('solana-balance: unexpected failure', cause instanceof Error ? cause.name : typeof cause)
    return failure('upstream', 502)
  }
}
