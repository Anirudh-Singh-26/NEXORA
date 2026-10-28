/**
 * Browser client for NEXORA's read-only `/api/wallet-tokens` proxy (Alchemy Token API, server-side key).
 * Pure TypeScript: no React. Responses are validated, and a response for a different chain/address than the one
 * requested is rejected, so data for another account can never be attached to the current one.
 */
import { formatUnits, normalizeAddress } from '../blockchain/normalize.ts'
import { groupDecimal } from '../blockchain/wallet-balance.ts'
import { isWalletTokenChain } from './chains.ts'

export interface WalletToken {
  /** Lowercased contract address. */
  contract: string
  name: string | null
  symbol: string | null
  /** null when the provider returned no usable decimals: the balance cannot then be formatted and is never guessed. */
  decimals: number | null
  /** Integer string in the token's smallest unit. */
  rawBalance: string
  logo: string | null
}

export interface WalletTokensPage {
  chainId: number
  address: string
  tokens: WalletToken[]
  nextPageKey: string | null
  metadataPartial: boolean
}

export type WalletTokensErrorKind =
  | 'not-configured' | 'invalid-request' | 'rate-limited' | 'provider-auth' | 'chain-unsupported' | 'upstream'
  | 'proxy-missing' | 'network' | 'timeout' | 'malformed' | 'aborted'

export type WalletTokensResult =
  | { status: 'ok'; page: WalletTokensPage }
  | { status: 'error'; kind: WalletTokensErrorKind; message: string; retryable: boolean }

export type TokenTarget =
  | { kind: 'no-wallet' }
  | { kind: 'invalid-address' }
  | { kind: 'unknown-network' }
  | { kind: 'unsupported-network'; chainId: number }
  | { kind: 'ready'; chainId: number; address: string }

/** Pure: can token balances be requested for this account/chain, and if not, why. */
export function resolveTokenTarget(address: string | null, chainId: number | null): TokenTarget {
  if (!address) return { kind: 'no-wallet' }
  const normalized = normalizeAddress(address)
  if (!normalized) return { kind: 'invalid-address' }
  if (chainId === null) return { kind: 'unknown-network' }
  if (!isWalletTokenChain(chainId)) return { kind: 'unsupported-network', chainId }
  return { kind: 'ready', chainId, address: normalized }
}

const MESSAGES: Record<WalletTokensErrorKind, string> = {
  'not-configured': 'Token balances are not set up on this deployment (the server needs ALCHEMY_API_KEY).',
  'invalid-request': 'The token request was invalid.',
  'rate-limited': 'The token data provider is rate limiting requests. Try again shortly.',
  'provider-auth': 'The token data provider rejected the server credentials.',
  'chain-unsupported': 'The token data provider does not offer token balances for this network on the configured plan.',
  upstream: 'The token data provider is unavailable right now.',
  'proxy-missing': 'The /api/wallet-tokens proxy is not reachable. Run the app with `npm run dev` or deploy it to Vercel with ALCHEMY_API_KEY set.',
  network: 'Could not reach the token proxy.',
  timeout: 'The token request took too long.',
  malformed: 'The token proxy returned an unreadable response.',
  aborted: 'The request was cancelled.',
}
const RETRYABLE: ReadonlySet<WalletTokensErrorKind> = new Set(['rate-limited', 'upstream', 'network', 'timeout', 'malformed'])
const SERVER_KINDS: ReadonlySet<string> = new Set(['not-configured', 'invalid-request', 'rate-limited', 'provider-auth', 'chain-unsupported', 'upstream'])

function failure(kind: WalletTokensErrorKind): WalletTokensResult {
  return { status: 'error', kind, message: MESSAGES[kind], retryable: RETRYABLE.has(kind) }
}

const CONTRACT_RE = /^0x[0-9a-f]{40}$/
const PAGE_KEY_RE = /^[A-Za-z0-9_\-=:.+/]{1,1024}$/

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null
}

/** Validates the proxy's JSON. Malformed token entries are dropped; a malformed envelope throws. */
export function parseWalletTokensResponse(body: unknown): WalletTokensPage {
  const root = body as Record<string, unknown> | null
  if (!root || typeof root !== 'object' || !Array.isArray(root.tokens) || typeof root.chainId !== 'number' || typeof root.address !== 'string') {
    throw new Error('malformed')
  }
  const seen = new Set<string>()
  const tokens: WalletToken[] = []
  for (const entry of root.tokens as Array<Record<string, unknown>>) {
    if (!entry || typeof entry !== 'object') continue
    const contract = typeof entry.contract === 'string' ? entry.contract.toLowerCase() : ''
    const raw = entry.rawBalance
    if (!CONTRACT_RE.test(contract) || seen.has(contract)) continue
    if (typeof raw !== 'string' || !/^[0-9]+$/.test(raw) || BigInt(raw) === 0n) continue
    seen.add(contract)
    const decimals = typeof entry.decimals === 'number' && Number.isInteger(entry.decimals) && entry.decimals >= 0 && entry.decimals <= 36 ? entry.decimals : null
    const logo = typeof entry.logo === 'string' && entry.logo.startsWith('https://') ? entry.logo : null
    tokens.push({ contract, name: text(entry.name, 64), symbol: text(entry.symbol, 24), decimals, rawBalance: raw, logo })
  }
  const nextPageKey = typeof root.nextPageKey === 'string' && PAGE_KEY_RE.test(root.nextPageKey) ? root.nextPageKey : null
  return { chainId: root.chainId, address: root.address.toLowerCase(), tokens, nextPageKey, metadataPartial: root.metadataPartial === true }
}

export interface FetchOptions {
  pageKey?: string | null
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  endpoint?: string
  timeoutMs?: number
}

export async function fetchWalletTokens(chainId: number, address: string, options: FetchOptions = {}): Promise<WalletTokensResult> {
  const normalized = normalizeAddress(address)
  if (!normalized || !isWalletTokenChain(chainId)) return failure('invalid-request')
  const query = new URLSearchParams({ chainId: String(chainId), address: normalized })
  if (options.pageKey) query.set('pageKey', options.pageKey)

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, options.timeoutMs ?? 20_000)
  const onAbort = () => controller.abort()
  if (options.signal?.aborted) { clearTimeout(timer); return failure('aborted') }
  options.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await (options.fetchImpl ?? fetch)(`${options.endpoint ?? '/api/wallet-tokens'}?${query}`, { headers: { accept: 'application/json' }, signal: controller.signal })
    const contentType = response.headers.get('content-type') ?? ''
    // The SPA fallback serves index.html for unknown paths: that means the proxy is not deployed or not running.
    if (!contentType.includes('json')) return failure(response.status === 404 || contentType.includes('html') ? 'proxy-missing' : 'malformed')
    let body: unknown
    try { body = await response.json() } catch { return failure('malformed') }
    if (!response.ok) {
      const code = (body as { error?: { code?: unknown } } | null)?.error?.code
      return failure(typeof code === 'string' && SERVER_KINDS.has(code) ? (code as WalletTokensErrorKind) : 'upstream')
    }
    let page: WalletTokensPage
    try { page = parseWalletTokensResponse(body) } catch { return failure('malformed') }
    // Never accept data for a different account or chain than the one that was requested.
    if (page.chainId !== chainId || page.address !== normalized) return failure('malformed')
    return { status: 'ok', page }
  } catch {
    if (timedOut) return failure('timeout')
    if (options.signal?.aborted) return failure('aborted')
    return failure('network')
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

export const BALANCE_MAX_FRACTION = 6

/**
 * Formats a raw token amount with its decimals, truncating (never rounding up). Returns null when decimals are unknown.
 * Non-zero amounts too small to show at 6 decimals are shown as "<0.000001".
 */
export function formatTokenBalance(rawBalance: string, decimals: number | null): string | null {
  if (decimals === null || !/^[0-9]+$/.test(rawBalance)) return null
  const raw = BigInt(rawBalance)
  const formatted = formatUnits(raw, decimals, BALANCE_MAX_FRACTION)
  if (raw > 0n && formatted === '0') return `<0.${'0'.repeat(BALANCE_MAX_FRACTION - 1)}1`
  return groupDecimal(formatted)
}
