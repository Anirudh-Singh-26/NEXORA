/**
 * Browser client + pure helpers for NEXORA's read-only `/api/solana-balance` proxy (native SOL only, no SPL tokens).
 * No React. A response for a different address than the one requested is rejected, so a balance can never be
 * attached to the wrong account. The proxy (api/solana-balance.ts) also imports `isSolanaAddress` from here.
 */
import { formatUnits } from '../blockchain/normalize.ts'
import { groupDecimal } from '../blockchain/wallet-balance.ts'

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export const LAMPORTS_DECIMALS = 9

/** True only for a base58 string that decodes to exactly 32 bytes (a Solana public key). Case-sensitive. */
export function isSolanaAddress(value: unknown): value is string {
  if (typeof value !== 'string' || !BASE58_RE.test(value)) return false
  let n = 0n
  for (const char of value) n = n * 58n + BigInt(BASE58.indexOf(char))
  let bytes = 0
  for (let rest = n; rest > 0n; rest >>= 8n) bytes += 1
  for (const char of value) { if (char === '1') bytes += 1; else break } // each leading '1' is one leading zero byte
  return bytes === 32
}

/** Exact lamports → SOL decimal string using BigInt (never floating point). Up to 9 fraction digits, no rounding. */
export function lamportsToSol(lamports: bigint | string): string {
  const value = typeof lamports === 'string' ? BigInt(lamports) : lamports
  return formatUnits(value, LAMPORTS_DECIMALS, LAMPORTS_DECIMALS)
}

export interface SolanaBalance {
  address: string
  /** Integer string in lamports (1 SOL = 1,000,000,000 lamports). */
  lamports: string
  /** Exact SOL amount without grouping, e.g. "1.5". */
  sol: string
  /** SOL amount with thousands separators for display. */
  display: string
}

export type SolanaBalanceErrorKind =
  | 'not-configured' | 'invalid-request' | 'rate-limited' | 'provider-auth' | 'upstream'
  | 'proxy-missing' | 'network' | 'timeout' | 'malformed' | 'aborted'

export type SolanaBalanceResult =
  | { status: 'ok'; balance: SolanaBalance }
  | { status: 'error'; kind: SolanaBalanceErrorKind; message: string; retryable: boolean }

export type SolanaBalanceTarget =
  | { kind: 'no-wallet' }
  | { kind: 'invalid-address' }
  /** Network was reported by the wallet but the balance endpoint does not serve it. */
  | { kind: 'unsupported-network'; networkName: string; reason: string }
  /** Wallet is connected but the active Solana network could not be determined. */
  | { kind: 'unknown-network' }
  /** Balance can be requested: address is valid and the network is Devnet. */
  | { kind: 'ready'; address: string; networkName: string }

/**
 * Pure: can a SOL balance be requested for this account on this network, and if not, why.
 *
 * `networkName` is the name AppKit reports for the active Solana network (e.g. "Solana", "Solana Devnet").
 * When undefined (backward-compat for unit tests that don't supply it) the check is skipped and the address
 * alone determines the target.  When null the wallet is connected but didn't report a network.
 *
 * The balance API endpoint is Solana Devnet. Devnet names ('devnet', 'Solana Devnet', etc.) are ready.
 * Mainnet names ('mainnet', 'Solana', 'solana-mainnet') are unsupported: the endpoint would return Devnet
 * data and presenting it as Mainnet would be misleading.
 */
export function resolveSolanaTarget(address: string | null, networkName?: string | null): SolanaBalanceTarget {
  if (!address) return { kind: 'no-wallet' }
  if (!isSolanaAddress(address)) return { kind: 'invalid-address' }
  // networkName === undefined means the caller does not supply network info (e.g. legacy unit tests).
  if (networkName === undefined) return { kind: 'ready', address, networkName: 'Solana Devnet' }
  // networkName === null means the wallet is connected but did not report its network.
  if (!networkName) return { kind: 'unknown-network' }
  const lower = networkName.toLowerCase()
  // Devnet and testnet are served by the /api/solana-balance Devnet endpoint.
  if (lower.includes('devnet') || lower.includes('testnet') || lower.includes('localnet')) {
    return { kind: 'ready', address, networkName }
  }
  // Mainnet and any other network are explicitly unsupported.
  const isMainnet = lower.includes('mainnet') || lower === 'solana'
  const reason = isMainnet
    ? `SOL balances are read from Solana Devnet only. Disconnect your Mainnet wallet or switch to Devnet.`
    : `Network "${networkName}" is not supported for Solana balances (Devnet only).`
  return { kind: 'unsupported-network', networkName, reason }
}

const MESSAGES: Record<SolanaBalanceErrorKind, string> = {
  'not-configured': 'SOL balances are not set up on this deployment (the server needs ALCHEMY_API_KEY).',
  'invalid-request': 'The balance request was invalid.',
  'rate-limited': 'The balance data provider is rate limiting requests. Try again shortly.',
  'provider-auth': 'The balance data provider rejected the server credentials.',
  upstream: 'The balance data provider is unavailable right now.',
  'proxy-missing': 'The /api/solana-balance proxy is not reachable. Run the app with `npm run dev` or deploy it to Vercel with ALCHEMY_API_KEY set.',
  network: 'Could not reach the balance proxy.',
  timeout: 'The balance request took too long.',
  malformed: 'The balance proxy returned an unreadable response.',
  aborted: 'The request was cancelled.',
}
// Setup problems (missing proxy/key, rejected credentials) can be fixed while the page is open, so they offer Retry too.
const RETRYABLE: ReadonlySet<SolanaBalanceErrorKind> = new Set(['rate-limited', 'upstream', 'network', 'timeout', 'malformed', 'proxy-missing', 'not-configured', 'provider-auth'])
const SERVER_KINDS: ReadonlySet<string> = new Set(['not-configured', 'invalid-request', 'rate-limited', 'provider-auth', 'upstream'])

function failure(kind: SolanaBalanceErrorKind): SolanaBalanceResult {
  return { status: 'error', kind, message: MESSAGES[kind], retryable: RETRYABLE.has(kind) }
}

/** Validates the proxy's JSON. Throws on anything malformed. */
export function parseSolanaBalanceResponse(body: unknown): SolanaBalance {
  const root = body as Record<string, unknown> | null
  if (!root || typeof root !== 'object' || !isSolanaAddress(root.address) || typeof root.lamports !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(root.lamports)) {
    throw new Error('malformed')
  }
  const sol = lamportsToSol(root.lamports)
  return { address: root.address, lamports: root.lamports, sol, display: groupDecimal(sol) }
}

export interface FetchSolanaOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  endpoint?: string
  timeoutMs?: number
}

export async function fetchSolanaBalance(address: string, options: FetchSolanaOptions = {}): Promise<SolanaBalanceResult> {
  if (!isSolanaAddress(address)) return failure('invalid-request')
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, options.timeoutMs ?? 20_000)
  const onAbort = () => controller.abort()
  if (options.signal?.aborted) { clearTimeout(timer); return failure('aborted') }
  options.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const query = new URLSearchParams({ address })
    const response = await (options.fetchImpl ?? fetch)(`${options.endpoint ?? '/api/solana-balance'}?${query}`, { headers: { accept: 'application/json' }, signal: controller.signal })
    const contentType = response.headers.get('content-type') ?? ''
    // The SPA fallback serves index.html for unknown paths: that means the proxy is not deployed or not running.
    if (!contentType.includes('json')) return failure(response.status === 404 || contentType.includes('html') ? 'proxy-missing' : 'malformed')
    let body: unknown
    try { body = await response.json() } catch { return failure('malformed') }
    if (!response.ok) {
      const code = (body as { error?: { code?: unknown } } | null)?.error?.code
      return failure(typeof code === 'string' && SERVER_KINDS.has(code) ? (code as SolanaBalanceErrorKind) : 'upstream')
    }
    let balance: SolanaBalance
    try { balance = parseSolanaBalanceResponse(body) } catch { return failure('malformed') }
    // Never accept a balance for a different account than the one that was requested.
    if (balance.address !== address) return failure('malformed')
    return { status: 'ok', balance }
  } catch {
    if (timedOut) return failure('timeout')
    if (options.signal?.aborted) return failure('aborted')
    return failure('network')
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}
