/**
 * Shared server-side Solana DEVNET JSON-RPC helper for /api/solana-activity and /api/solana-transfer.
 * (The leading underscore keeps Vercel from exposing this file as a route.)
 *
 * Provider order matches /api/solana-balance: Alchemy's Devnet host when ALCHEMY_API_KEY is set, then the public Devnet RPC.
 * Any Alchemy failure (401/403 because the app has no Solana Devnet network enabled, a rate limit, an outage, a timeout or an
 * unreadable answer) falls through to the public endpoint; if that fails too, its classified error is reported. There is no mainnet URL anywhere in this module. The API key lives
 * only in this server process: error messages are fixed strings and never contain a URL, key or raw provider text.
 */
import { SOLANA_DEVNET_GENESIS_HASH, SOLANA_DEVNET_RPC_URL, solanaDevnetRpcUrl } from '../src/lib/network/testnet.ts'

export const UPSTREAM_TIMEOUT_MS = 10_000

export type ErrorCode = 'not-configured' | 'invalid-request' | 'method-not-allowed' | 'rate-limited' | 'provider-auth' | 'upstream' | 'wrong-cluster'

export class ProxyError extends Error {
  code: ErrorCode
  status: number
  /** Lower-cased JSON-RPC error text, kept SERVER-SIDE only so a handler can classify it; never sent to a client. */
  rpcMessage: string | null
  constructor(code: ErrorCode, status: number, rpcMessage: string | null = null) { super(code); this.code = code; this.status = status; this.rpcMessage = rpcMessage }
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  'not-configured': 'The Solana data provider is not configured on the server.',
  'invalid-request': 'The request was invalid.',
  'method-not-allowed': 'This HTTP method is not supported here.',
  'rate-limited': 'The Solana data provider is rate limiting requests. Try again shortly.',
  'provider-auth': 'The Solana data provider rejected the server credentials.',
  upstream: 'The Solana data provider is unavailable right now.',
  'wrong-cluster': 'The Solana data provider did not answer from Devnet, so the request was refused.',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    // Per-address / per-transaction data: never let a shared cache store or reuse it.
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  })
}

export function failure(code: ErrorCode, status: number): Response {
  return json({ error: { code, message: ERROR_MESSAGES[code] } }, status)
}

function mapHttpStatus(status: number): ProxyError | null {
  if (status === 429) return new ProxyError('rate-limited', 429)
  if (status === 401 || status === 403) return new ProxyError('provider-auth', 502)
  if (status < 200 || status >= 300) return new ProxyError('upstream', 502)
  return null
}

function mapRpcError(body: unknown): ProxyError | null {
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error
  if (!error) return null
  const code = typeof error.code === 'number' ? error.code : null
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : ''
  if (code === 429 || message.includes('rate limit') || message.includes('compute units') || message.includes('too many requests')) return new ProxyError('rate-limited', 429)
  if (message.includes('invalid api key') || message.includes('unauthorized')) return new ProxyError('provider-auth', 502)
  return new ProxyError('upstream', 502, message)
}

export interface RpcOptions { apiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number }

async function rpcOnce(url: string, method: string, params: unknown[], options: RpcOptions): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args))
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(options.timeoutMs ?? UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    // The thrown error can mention the URL (which contains the key): never forward it.
    throw new ProxyError('upstream', 502)
  }
  let body: unknown = null
  try { body = await response.json() } catch { /* non-JSON body */ }
  const failed = mapHttpStatus(response.status) ?? mapRpcError(body)
  if (failed) throw failed
  if (body === null || typeof body !== 'object') throw new ProxyError('upstream', 502)
  return body
}

/** Devnet RPC call with the provider order above. Resolves with the whole JSON-RPC body (`result` is NOT unwrapped). */
export async function devnetRpc(method: string, params: unknown[], options: RpcOptions = {}): Promise<{ body: unknown; provider: 'alchemy' | 'solana-devnet-public' }> {
  const providers: Array<{ name: 'alchemy' | 'solana-devnet-public'; url: string }> = []
  if (options.apiKey) providers.push({ name: 'alchemy', url: solanaDevnetRpcUrl(options.apiKey) })
  providers.push({ name: 'solana-devnet-public', url: SOLANA_DEVNET_RPC_URL })
  let last = new ProxyError('upstream', 502)
  for (const provider of providers) {
    try {
      return { body: await rpcOnce(provider.url, method, params, options), provider: provider.name }
    } catch (cause) {
      last = cause instanceof ProxyError ? cause : new ProxyError('upstream', 502)
      // Any failure of one provider (rejected credential, disabled network, rate limit, outage, timeout, malformed answer)
      // moves on to the next one; only when every provider has failed is the LAST provider's classified error reported.
    }
  }
  throw last
}

/** Devnet RPC call returning just `result`. */
export async function devnetResult(method: string, params: unknown[], options: RpcOptions = {}): Promise<{ result: unknown; provider: string }> {
  const { body, provider } = await devnetRpc(method, params, options)
  if (!('result' in (body as object))) throw new ProxyError('upstream', 502)
  return { result: (body as { result: unknown }).result, provider }
}

/** Refuses to continue unless the answering cluster's genesis hash is Solana Devnet's. */
export async function assertDevnet(options: RpcOptions = {}): Promise<void> {
  const { result } = await devnetResult('getGenesisHash', [], options)
  if (result !== SOLANA_DEVNET_GENESIS_HASH) throw new ProxyError('wrong-cluster', 502)
}

/** An exact lamport integer as a decimal string, or a thrown upstream error for anything else. */
export function lamportsString(value: unknown): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new ProxyError('upstream', 502)
  return String(value)
}
