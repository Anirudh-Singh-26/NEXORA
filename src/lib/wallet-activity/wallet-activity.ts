/**
 * Browser clients for NEXORA's read-only `/api/wallet-activity` (EVM) and `/api/solana-activity` proxies, plus the pure
 * helpers the Activity page needs (target resolution, direction, filters, grouping). No React.
 * Responses are validated, and a response for a different chain/address than the one requested is rejected, so history
 * for another account can never be attached to the current one. Nothing here signs, sends or writes anything.
 */
import { normalizeAddress } from '../blockchain/normalize.ts'
import { isSolanaAddress } from '../solana-balance/solana-balance.ts'
import { isActivityChain, SOLANA_SIGNATURE_PATTERN } from './chains.ts'
import type { EvmActivityItem, EvmTransfer, SolanaActivityItem, SolanaTxDetails, TransferCategory } from './types.ts'

export type EvmEntry = EvmActivityItem & { id: string }
export type SolanaEntry = SolanaActivityItem & { id: string }

export type ActivityErrorKind =
  | 'not-configured' | 'invalid-request' | 'rate-limited' | 'provider-auth' | 'chain-unsupported' | 'upstream'
  | 'proxy-missing' | 'network' | 'timeout' | 'malformed' | 'aborted'

export type PageResult<T> =
  | { status: 'ok'; items: T[]; nextCursor: string | null }
  | { status: 'error'; kind: ActivityErrorKind; message: string; retryable: boolean }

// ---- targets ------------------------------------------------------------------------------------------------------

export type ActivityTarget =
  | { kind: 'no-wallet' }
  | { kind: 'invalid-address' }
  | { kind: 'unknown-network' }
  | { kind: 'unsupported-network'; chainId: number | null; reason: string }
  | { kind: 'ready'; ecosystem: 'evm'; chainId: number; address: string; key: string }
  | { kind: 'ready'; ecosystem: 'solana'; address: string; key: string }

export interface TargetInput {
  ecosystem: 'evm' | 'solana' | null
  address: string | null
  /** EVM chain ID reported by the wallet (null when unknown). */
  chainId: number | null
  /** Solana cluster name reported by the wallet, when known (e.g. "Solana", "Solana Devnet"). */
  solanaNetworkName?: string | null
}

/** Pure: can activity be requested for this account, and if not, why. The key identifies ecosystem + chain + address. */
export function resolveActivityTarget(input: TargetInput): ActivityTarget {
  if (!input.ecosystem || !input.address) return { kind: 'no-wallet' }
  if (input.ecosystem === 'solana') {
    if (!isSolanaAddress(input.address)) return { kind: 'invalid-address' }
    // Solana history is read from DEVNET only (the proxy is pinned to it). A wallet on any other cluster gets no request
    // at all, so mainnet data can never be shown while the wallet is on Devnet, or the reverse.
    // null means the wallet is connected but did not report a network: do not guess.
    // undefined means the caller did not supply a network constraint (the data is Devnet and is labelled as such).
    if (input.solanaNetworkName === null) return { kind: 'unknown-network' }
    if (input.solanaNetworkName !== undefined && !/devnet/i.test(input.solanaNetworkName)) {
      const mainnet = /mainnet/i.test(input.solanaNetworkName) || input.solanaNetworkName.toLowerCase() === 'solana'
      const reason = mainnet
        ? 'Your wallet is on Solana Mainnet. NEXORA reads Solana activity from Devnet only, so no mainnet transactions are shown.'
        : `Your wallet is on "${input.solanaNetworkName}". NEXORA reads Solana activity from Devnet only.`
      return { kind: 'unsupported-network', chainId: null, reason }
    }
    return { kind: 'ready', ecosystem: 'solana', address: input.address, key: `solana-devnet:${input.address}` }
  }
  const address = normalizeAddress(input.address)
  if (!address) return { kind: 'invalid-address' }
  if (input.chainId === null) return { kind: 'unknown-network' }
  if (!isActivityChain(input.chainId)) return { kind: 'unsupported-network', chainId: input.chainId, reason: 'The activity provider does not offer transaction history for this network.' }
  return { kind: 'ready', ecosystem: 'evm', chainId: input.chainId, address, key: `evm:${input.chainId}:${address}` }
}

// ---- errors -------------------------------------------------------------------------------------------------------

const MESSAGES: Record<ActivityErrorKind, string> = {
  'not-configured': 'Wallet activity is not set up on this deployment (the server needs ALCHEMY_API_KEY).',
  'invalid-request': 'The activity request was invalid.',
  'rate-limited': 'The activity data provider is rate limiting requests. Try again shortly.',
  'provider-auth': 'The activity data provider rejected the server credentials.',
  'chain-unsupported': 'The activity data provider does not offer transaction history for this network on the configured plan.',
  upstream: 'The activity data provider is unavailable right now.',
  'proxy-missing': 'The activity proxy is not reachable. Run the app with `npm run dev` or deploy it to Vercel with ALCHEMY_API_KEY set.',
  network: 'Could not reach the activity proxy.',
  timeout: 'The activity request took too long.',
  malformed: 'The activity proxy returned an unreadable response.',
  aborted: 'The request was cancelled.',
}
const RETRYABLE: ReadonlySet<ActivityErrorKind> = new Set(['rate-limited', 'upstream', 'network', 'timeout', 'malformed'])
const SERVER_KINDS: ReadonlySet<string> = new Set(['not-configured', 'invalid-request', 'rate-limited', 'provider-auth', 'chain-unsupported', 'upstream'])

function failure<T>(kind: ActivityErrorKind): PageResult<T> {
  return { status: 'error', kind, message: MESSAGES[kind], retryable: RETRYABLE.has(kind) }
}

// ---- parsing ------------------------------------------------------------------------------------------------------

const HASH_RE = /^0x[0-9a-f]{64}$/
const ADDR_RE = /^0x[0-9a-f]{40}$/
const CURSOR_RE = /^[0-9]{1,12}$/
const CATEGORIES: readonly string[] = ['external', 'erc20', 'erc721', 'erc1155']

function optionalAddress(value: unknown): string | null {
  return typeof value === 'string' && ADDR_RE.test(value.toLowerCase()) ? value.toLowerCase() : null
}

function parseTransfer(entry: unknown): EvmTransfer | null {
  const t = entry as Record<string, unknown> | null
  if (!t || typeof t !== 'object' || typeof t.category !== 'string' || !CATEGORIES.includes(t.category)) return null
  const category = t.category as TransferCategory
  const from = optionalAddress(t.from)
  const to = optionalAddress(t.to)
  if (!from && !to) return null
  const asset = typeof t.asset === 'string' && t.asset.length > 0 && t.asset.length <= 24 ? t.asset : null
  const amount = typeof t.amount === 'string' && /^[0-9]+(\.[0-9]+)?$/.test(t.amount) && t.amount.length <= 80 ? t.amount : null
  const tokenId = typeof t.tokenId === 'string' && /^[0-9]{1,80}$/.test(t.tokenId) ? t.tokenId : null
  return { category, from, to, asset, amount, contract: category === 'external' ? null : optionalAddress(t.contract), tokenId }
}

/** Validates the EVM proxy's JSON. Malformed items are dropped, a malformed envelope throws. */
export function parseEvmActivityResponse(body: unknown): { chainId: number; address: string; items: EvmEntry[]; nextCursor: string | null } {
  const root = body as Record<string, unknown> | null
  if (!root || typeof root !== 'object' || !Array.isArray(root.items) || typeof root.chainId !== 'number' || typeof root.address !== 'string') throw new Error('malformed')
  const seen = new Set<string>()
  const items: EvmEntry[] = []
  for (const raw of root.items as Array<Record<string, unknown>>) {
    if (!raw || typeof raw !== 'object') continue
    const hash = typeof raw.hash === 'string' ? raw.hash.toLowerCase() : ''
    if (!HASH_RE.test(hash) || seen.has(hash) || !Array.isArray(raw.transfers)) continue
    const blockNumber = raw.blockNumber
    if (typeof blockNumber !== 'number' || !Number.isSafeInteger(blockNumber) || blockNumber < 0) continue
    const transfers = (raw.transfers as unknown[]).map(parseTransfer).filter((t): t is EvmTransfer => t !== null)
    if (transfers.length === 0) continue
    const stamp = typeof raw.timestamp === 'string' ? Date.parse(raw.timestamp) : NaN
    seen.add(hash)
    items.push({ id: hash, hash, blockNumber, timestamp: Number.isFinite(stamp) ? new Date(stamp).toISOString() : null, transfers })
  }
  const nextCursor = typeof root.nextCursor === 'string' && CURSOR_RE.test(root.nextCursor) ? root.nextCursor : null
  return { chainId: root.chainId, address: root.address.toLowerCase(), items, nextCursor }
}

const LAMPORTS_RE = /^(0|[1-9][0-9]{0,19})$/
const SIGNED_LAMPORTS_RE = /^-?(0|[1-9][0-9]{0,19})$/

/** Validates one `details` object from the proxy; anything malformed becomes null ("details unavailable"). */
function parseDetails(raw: unknown): SolanaTxDetails | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  if (d.kind !== 'transfer' && d.kind !== 'other') return null
  if (d.direction !== 'sent' && d.direction !== 'received' && d.direction !== 'self' && d.direction !== 'other') return null
  const lamports = typeof d.lamports === 'string' && LAMPORTS_RE.test(d.lamports) ? d.lamports : null
  // An amount is only ever claimed for a plain transfer.
  if (lamports !== null && d.kind !== 'transfer') return null
  const net = typeof d.netChangeLamports === 'string' && SIGNED_LAMPORTS_RE.test(d.netChangeLamports) ? d.netChangeLamports : null
  const fee = typeof d.feeLamports === 'string' && LAMPORTS_RE.test(d.feeLamports) ? d.feeLamports : null
  const counterparty = typeof d.counterparty === 'string' && isSolanaAddress(d.counterparty) ? d.counterparty : null
  return { kind: d.kind, direction: d.direction, counterparty, lamports, netChangeLamports: net, feeLamports: fee }
}

/**
 * Validates the Solana proxy's JSON. Malformed items are dropped, a malformed envelope throws. The envelope must say
 * `cluster: "devnet"`: a response from anywhere else is rejected rather than shown.
 */
export function parseSolanaActivityResponse(body: unknown): { address: string; items: SolanaEntry[]; nextCursor: string | null } {
  const root = body as Record<string, unknown> | null
  if (!root || typeof root !== 'object' || !Array.isArray(root.items) || !isSolanaAddress(root.address) || root.cluster !== 'devnet') throw new Error('malformed')
  const seen = new Set<string>()
  const items: SolanaEntry[] = []
  for (const raw of root.items as Array<Record<string, unknown>>) {
    if (!raw || typeof raw !== 'object') continue
    const signature = raw.signature
    if (typeof signature !== 'string' || !SOLANA_SIGNATURE_PATTERN.test(signature) || seen.has(signature)) continue
    if (typeof raw.slot !== 'number' || !Number.isSafeInteger(raw.slot) || raw.slot < 0) continue
    seen.add(signature)
    const blockTime = typeof raw.blockTime === 'number' && Number.isSafeInteger(raw.blockTime) && raw.blockTime > 0 ? raw.blockTime : null
    const status = raw.status === 'success' || raw.status === 'failed' ? raw.status : null
    const confirmation = raw.confirmation === 'processed' || raw.confirmation === 'confirmed' || raw.confirmation === 'finalized' ? raw.confirmation : null
    items.push({ id: signature, signature, slot: raw.slot, blockTime, status, confirmation, details: parseDetails(raw.details) })
  }
  const nextCursor = typeof root.nextCursor === 'string' && SOLANA_SIGNATURE_PATTERN.test(root.nextCursor) ? root.nextCursor : null
  return { address: root.address, items, nextCursor }
}

// ---- fetching -----------------------------------------------------------------------------------------------------

export interface FetchOptions {
  cursor?: string | null
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  endpoint?: string
  timeoutMs?: number
}

async function requestJson(endpoint: string, query: URLSearchParams, options: FetchOptions): Promise<{ ok: true; body: unknown } | { ok: false; kind: ActivityErrorKind }> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, options.timeoutMs ?? 20_000)
  const onAbort = () => controller.abort()
  if (options.signal?.aborted) { clearTimeout(timer); return { ok: false, kind: 'aborted' } }
  options.signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await (options.fetchImpl ?? fetch)(`${endpoint}?${query}`, { headers: { accept: 'application/json' }, signal: controller.signal })
    const contentType = response.headers.get('content-type') ?? ''
    // The SPA fallback serves index.html for unknown paths: that means the proxy is not deployed or not running.
    if (!contentType.includes('json')) return { ok: false, kind: response.status === 404 || contentType.includes('html') ? 'proxy-missing' : 'malformed' }
    let body: unknown
    try { body = await response.json() } catch { return { ok: false, kind: 'malformed' } }
    if (!response.ok) {
      const code = (body as { error?: { code?: unknown } } | null)?.error?.code
      return { ok: false, kind: typeof code === 'string' && SERVER_KINDS.has(code) ? (code as ActivityErrorKind) : 'upstream' }
    }
    return { ok: true, body }
  } catch {
    if (timedOut) return { ok: false, kind: 'timeout' }
    if (options.signal?.aborted) return { ok: false, kind: 'aborted' }
    return { ok: false, kind: 'network' }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

export async function fetchEvmActivity(chainId: number, address: string, options: FetchOptions = {}): Promise<PageResult<EvmEntry>> {
  const normalized = normalizeAddress(address)
  if (!normalized || !isActivityChain(chainId) || (options.cursor && !CURSOR_RE.test(options.cursor))) return failure('invalid-request')
  const query = new URLSearchParams({ chainId: String(chainId), address: normalized })
  if (options.cursor) query.set('cursor', options.cursor)
  const result = await requestJson(options.endpoint ?? '/api/wallet-activity', query, options)
  if (!result.ok) return failure(result.kind)
  try {
    const page = parseEvmActivityResponse(result.body)
    // Never accept data for a different account or chain than the one that was requested.
    if (page.chainId !== chainId || page.address !== normalized) return failure('malformed')
    return { status: 'ok', items: page.items, nextCursor: page.nextCursor }
  } catch { return failure('malformed') }
}

export async function fetchSolanaActivity(address: string, options: FetchOptions = {}): Promise<PageResult<SolanaEntry>> {
  if (!isSolanaAddress(address) || (options.cursor && !SOLANA_SIGNATURE_PATTERN.test(options.cursor))) return failure('invalid-request')
  const query = new URLSearchParams({ address })
  if (options.cursor) query.set('cursor', options.cursor)
  const result = await requestJson(options.endpoint ?? '/api/solana-activity', query, options)
  if (!result.ok) return failure(result.kind)
  try {
    const page = parseSolanaActivityResponse(result.body)
    if (page.address !== address) return failure('malformed')
    return { status: 'ok', items: page.items, nextCursor: page.nextCursor }
  } catch { return failure('malformed') }
}

// ---- presentation helpers (pure) ----------------------------------------------------------------------------------

export type Direction = 'sent' | 'received' | 'self' | 'other'
export type EvmKind = 'native' | 'token' | 'nft'
export type TimeGroup = 'Today' | 'Earlier' | 'Date unavailable'

/** Direction of a transaction relative to the wallet, judged by its primary (first) transfer. */
export function directionFor(item: EvmEntry, wallet: string): Direction {
  const me = wallet.toLowerCase()
  const primary = item.transfers[0]
  if (!primary) return 'other'
  if (primary.from === me && primary.to === me) return 'self'
  if (primary.from === me) return 'sent'
  if (primary.to === me) return 'received'
  return 'other'
}

/** The kinds of asset movement a transaction contains (a swap can contain several). */
export function kindsFor(item: EvmEntry): EvmKind[] {
  const kinds = new Set<EvmKind>()
  for (const t of item.transfers) kinds.add(t.category === 'external' ? 'native' : t.category === 'erc20' ? 'token' : 'nft')
  return [...kinds]
}

export const EVM_KIND_LABEL: Record<EvmKind, string> = { native: 'Native', token: 'Tokens', nft: 'NFTs' }
export const EVM_KINDS: EvmKind[] = ['native', 'token', 'nft']

/** Local-calendar grouping. Rows without a timestamp are never placed in a date bucket they cannot be proven to belong to. */
export function timeGroup(timestamp: string | null, now: Date = new Date()): TimeGroup {
  if (!timestamp) return 'Date unavailable'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toDateString() === now.toDateString() ? 'Today' : 'Earlier'
}

export function solanaTimestamp(item: SolanaEntry): string | null {
  return item.blockTime === null ? null : new Date(item.blockTime * 1000).toISOString()
}

export function shortHash(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
}

export function shortAddress(value: string | null): string {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : 'Unknown'
}

/** Search over what is actually on screen: hash, addresses, asset symbol, contract. */
export function matchesEvmQuery(item: EvmEntry, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return item.hash.includes(q) || item.transfers.some((t) => [t.from, t.to, t.contract, t.asset?.toLowerCase(), t.tokenId].some((field) => field?.includes(q)))
}

export interface EvmFilters { kind: 'all' | EvmKind; time: 'all' | 'Today' | 'Earlier'; query: string }

export function filterEvm(items: readonly EvmEntry[], filters: EvmFilters, now: Date = new Date()): EvmEntry[] {
  return items.filter((item) => {
    if (filters.kind !== 'all' && !kindsFor(item).includes(filters.kind)) return false
    if (filters.time !== 'all' && timeGroup(item.timestamp, now) !== filters.time) return false
    return matchesEvmQuery(item, filters.query)
  })
}

export function filterSolana(items: readonly SolanaEntry[], filters: Pick<EvmFilters, 'time' | 'query'>, now: Date = new Date()): SolanaEntry[] {
  const q = filters.query.trim()
  return items.filter((item) => {
    if (filters.time !== 'all' && timeGroup(solanaTimestamp(item), now) !== filters.time) return false
    const needle = q.toLowerCase()
    return !q || item.signature.toLowerCase().includes(needle) || (item.details?.counterparty ?? '').toLowerCase().includes(needle)
  })
}
