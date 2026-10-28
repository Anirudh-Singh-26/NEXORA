import { WALLET_NETWORK_CONFIG } from '../src/lib/wallet/network-config.ts'
/**
 * GET /api/wallet-activity?chainId=<id>&address=<0x…>[&cursor=<opaque>]
 *
 * Read-only proxy for a wallet's EVM transaction history using Alchemy's Transfers API (`alchemy_getAssetTransfers`).
 * Plain JSON-RPC has no "list an account's transactions" method, so NEXORA relies on this indexed provider API and
 * never scans block ranges. The API key (ALCHEMY_API_KEY, no VITE_ prefix) lives only in this server process and is
 * never sent to the browser, logged, or included in any response. Read-only: no signing, no transfers, no writes.
 *
 * Activity scope (documented): transfers where the wallet is the sender OR the recipient, in the categories
 *   external (native-currency transactions, including zero-value contract calls the wallet sent), erc20, erc721, erc1155.
 * Internal transfers are deliberately excluded: Alchemy only serves them on Ethereum and Polygon, so including them
 * would make history inconsistent across chains. Events are grouped by transaction hash, so a swap that produced
 * one native transfer and two token transfers is ONE entry, not three. Receipts are not fetched, so no success/failed
 * status is reported for EVM transactions.
 *
 * Pagination: the cursor is a block number. Each page asks for the newest transfers (up to PAGE_SIZE per direction)
 * at or below that block, merges the "sent" and "received" streams, and only emits blocks that both streams fully
 * cover; the remainder is re-requested by the next page, so nothing is skipped or shown twice.
 *
 * Responses: 200 { chainId, address, items[], nextCursor, provider } or { error: { code, message } } with an HTTP status.
 * No URL or key ever appears in an error.
 */
import { ACTIVITY_CHAINS, isActivityChain } from '../src/lib/wallet-activity/chains.ts'
import type { EvmActivityItem, EvmTransfer, TransferCategory } from '../src/lib/wallet-activity/types.ts'

/** Per direction (sent / received) per page. Alchemy allows up to 1000; kept small so a page loads quickly. */
export const PAGE_SIZE = 50
const UPSTREAM_TIMEOUT_MS = 10_000
const CATEGORIES: TransferCategory[] = ['external', 'erc20', 'erc721', 'erc1155']
const CATEGORY_ORDER: Record<TransferCategory, number> = { external: 0, erc20: 1, erc721: 2, erc1155: 3 }

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const HASH_RE = /^0x[0-9a-fA-F]{64}$/
const HEX_RE = /^0x[0-9a-fA-F]{1,64}$/
const CURSOR_RE = /^[0-9]{1,12}$/

export type ErrorCode = 'not-configured' | 'invalid-request' | 'method-not-allowed' | 'rate-limited' | 'provider-auth' | 'chain-unsupported' | 'upstream'

export interface HandlerOptions { apiKey?: string; fetchImpl?: typeof fetch }

class ProxyError extends Error {
  code: ErrorCode
  status: number
  constructor(code: ErrorCode, status: number, message: string) { super(message); this.code = code; this.status = status }
}

const MESSAGES: Record<ErrorCode, string> = {
  'not-configured': 'The activity data provider is not configured on the server (ALCHEMY_API_KEY is missing).',
  'invalid-request': 'The request was invalid.',
  'method-not-allowed': 'Only GET is supported.',
  'rate-limited': 'The activity data provider is rate limiting requests. Try again shortly.',
  'provider-auth': 'The activity data provider rejected the server credentials.',
  'chain-unsupported': 'The activity data provider does not offer transaction history for this network on the configured plan.',
  upstream: 'The activity data provider is unavailable right now.',
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

/** A single provider transfer event, validated, before grouping. */
export interface RawTransfer extends EvmTransfer { uniqueId: string; hash: string; blockNumber: number; timestamp: string | null }

function formatExact(raw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals)
  const fraction = (raw % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return fraction ? `${raw / base}.${fraction}` : (raw / base).toString()
}

/** Exact decimal amount when the provider gave a raw value and decimals; otherwise the provider's number; otherwise null. */
function readAmount(entry: Record<string, unknown>, rawHex: unknown, decimalsHex: unknown): string | null {
  if (typeof rawHex === 'string' && HEX_RE.test(rawHex) && typeof decimalsHex === 'string' && /^0x[0-9a-fA-F]{1,2}$/.test(decimalsHex)) {
    const decimals = Number.parseInt(decimalsHex, 16)
    if (decimals <= 36) return formatExact(BigInt(rawHex), decimals)
  }
  const value = entry.value
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value.toString().includes('e') ? value.toFixed(18).replace(/\.?0+$/, '') : value.toString()
  return null
}

function cleanSymbol(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim()
  return cleaned ? cleaned.slice(0, 24) : null
}

function readAddress(value: unknown): string | null {
  return typeof value === 'string' && ADDRESS_RE.test(value) ? value.toLowerCase() : null
}

function readTimestamp(meta: unknown): string | null {
  const stamp = (meta as { blockTimestamp?: unknown } | null)?.blockTimestamp
  if (typeof stamp !== 'string' || stamp.length > 40) return null
  const ms = Date.parse(stamp)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

function hexToDecimal(hex: unknown): string | null {
  return typeof hex === 'string' && HEX_RE.test(hex) ? BigInt(hex).toString() : null
}

/** Validates one provider response. A malformed envelope throws; malformed individual transfers are dropped, never guessed. */
export function parseTransfers(body: unknown): { transfers: RawTransfer[]; hasMore: boolean } {
  const result = (body as { result?: unknown } | null)?.result as { transfers?: unknown; pageKey?: unknown } | undefined
  if (!result || !Array.isArray(result.transfers)) throw new ProxyError('upstream', 502, MESSAGES.upstream)
  const out: RawTransfer[] = []
  for (const entry of result.transfers as Array<Record<string, unknown>>) {
    if (!entry || typeof entry !== 'object') continue
    const category = entry.category as TransferCategory
    if (!CATEGORIES.includes(category)) continue
    const hash = entry.hash
    const uniqueId = entry.uniqueId
    if (typeof hash !== 'string' || !HASH_RE.test(hash) || typeof uniqueId !== 'string' || uniqueId.length === 0 || uniqueId.length > 128) continue
    if (typeof entry.blockNum !== 'string' || !HEX_RE.test(entry.blockNum)) continue
    const block = BigInt(entry.blockNum)
    if (block > BigInt(Number.MAX_SAFE_INTEGER)) continue
    const from = readAddress(entry.from)
    const to = readAddress(entry.to)
    if (!from && !to) continue
    const raw = (entry.rawContract && typeof entry.rawContract === 'object' ? entry.rawContract : {}) as Record<string, unknown>
    const contract = category === 'external' ? null : readAddress(raw.address)
    const base = { uniqueId, hash: hash.toLowerCase(), blockNumber: Number(block), timestamp: readTimestamp(entry.metadata), from, to, category, contract, asset: cleanSymbol(entry.asset) }

    if (category === 'erc1155') {
      const items = Array.isArray(entry.erc1155Metadata) ? (entry.erc1155Metadata as Array<Record<string, unknown>>) : []
      items.forEach((item, index) => {
        const tokenId = hexToDecimal(item?.tokenId)
        if (!tokenId) return
        const amount = typeof item.value === 'string' && HEX_RE.test(item.value) ? BigInt(item.value).toString() : null
        out.push({ ...base, uniqueId: `${uniqueId}#${index}`, tokenId, amount })
      })
      continue
    }
    if (category === 'erc721') {
      out.push({ ...base, tokenId: hexToDecimal(entry.erc721TokenId) ?? hexToDecimal(entry.tokenId), amount: null })
      continue
    }
    out.push({ ...base, tokenId: null, amount: readAmount(entry, raw.value, raw.decimal) })
  }
  return { transfers: out, hasMore: typeof result.pageKey === 'string' && result.pageKey.length > 0 }
}

/**
 * Merges the "sent" and "received" streams of one page. `streams` are each newest-first and capped at PAGE_SIZE with
 * `hasMore` telling whether older rows exist. A block is only emitted when every stream that has more rows reaches
 * below it (strictly newer than the cutoff); the rest is re-requested by the next page via the returned cursor.
 */
export function mergeStreams(streams: Array<{ transfers: RawTransfer[]; hasMore: boolean }>): { items: EvmActivityItem[]; nextBlock: number | null } {
  const mins = streams.filter((stream) => stream.hasMore && stream.transfers.length > 0).map((stream) => Math.min(...stream.transfers.map((t) => t.blockNumber)))
  const cutoff = mins.length > 0 ? Math.max(...mins) : null

  const seen = new Set<string>()
  const all: RawTransfer[] = []
  for (const stream of streams) for (const transfer of stream.transfers) {
    if (seen.has(transfer.uniqueId)) continue // the same event appears in both streams for a self-transfer
    seen.add(transfer.uniqueId)
    all.push(transfer)
  }
  let emitted = cutoff === null ? all : all.filter((transfer) => transfer.blockNumber > cutoff)
  let nextBlock: number | null = cutoff
  if (cutoff !== null && emitted.length === 0) {
    // Degenerate: a single block holds a whole page. Emit it and step below it rather than loop forever.
    emitted = all
    nextBlock = cutoff > 0 ? cutoff - 1 : null
  }

  emitted.sort((a, b) => b.blockNumber - a.blockNumber || CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category])
  const byHash = new Map<string, EvmActivityItem>()
  for (const transfer of emitted) {
    const { uniqueId: _uniqueId, hash, blockNumber, timestamp, ...rest } = transfer
    let item = byHash.get(hash)
    if (!item) { item = { hash, blockNumber, timestamp, transfers: [] }; byHash.set(hash, item) }
    if (!item.timestamp && timestamp) item.timestamp = timestamp
    item.transfers.push(rest)
  }
  return { items: [...byHash.values()], nextBlock }
}

// ---- upstream -----------------------------------------------------------------------------------------------------

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
  if (code === 429 || message.includes('rate limit') || message.includes('compute units') || message.includes('too many requests')) return new ProxyError('rate-limited', 429, MESSAGES['rate-limited'])
  if (code === -32601 || message.includes('not supported') || message.includes('not enabled') || message.includes('not available') || message.includes('not found')) return new ProxyError('chain-unsupported', 422, MESSAGES['chain-unsupported'])
  if (message.includes('invalid api key') || message.includes('unauthorized')) return new ProxyError('provider-auth', 502, MESSAGES['provider-auth'])
  return new ProxyError('upstream', 502, MESSAGES.upstream)
}

async function queryDirection(fetchImpl: typeof fetch, url: string, direction: 'fromAddress' | 'toAddress', address: string, toBlock: string) {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'alchemy_getAssetTransfers',
        params: [{ fromBlock: '0x0', toBlock, [direction]: address, category: CATEGORIES, order: 'desc', withMetadata: true, excludeZeroValue: false, maxCount: `0x${PAGE_SIZE.toString(16)}` }],
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    // The thrown error can mention the URL (which contains the key): never forward it.
    throw new ProxyError('upstream', 502, MESSAGES.upstream)
  }
  let body: unknown = null
  try { body = await response.json() } catch { /* non-JSON body */ }
  const httpError = mapHttpStatus(response.status) ?? mapRpcError(body)
  if (httpError) throw httpError
  return parseTransfers(body)
}

// ---- handler ------------------------------------------------------------------------------------------------------

export async function handleWalletActivity(request: Request, options: HandlerOptions = {}): Promise<Response> {
  if (request.method !== 'GET') return failure('method-not-allowed', 405)
  if (!options.apiKey) return failure('not-configured', 503)
  const params = new URL(request.url).searchParams
  const chainText = params.get('chainId') ?? ''
  const chainId = /^[0-9]{1,12}$/.test(chainText) ? Number(chainText) : NaN
  const address = params.get('address') ?? ''
  const cursor = params.get('cursor')
  if (!isActivityChain(chainId) || !ADDRESS_RE.test(address) || (cursor !== null && (!CURSOR_RE.test(cursor) || !Number.isSafeInteger(Number(cursor))))) return failure('invalid-request', 400)

  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args))
  const url = `https://${ACTIVITY_CHAINS[chainId].alchemy}${WALLET_NETWORK_CONFIG.providers.alchemyRpcHostSuffix}/${encodeURIComponent(options.apiKey)}`
  const normalized = address.toLowerCase()
  const toBlock = cursor === null ? 'latest' : `0x${Number(cursor).toString(16)}`

  try {
    const [sent, received] = await Promise.all([
      queryDirection(fetchImpl, url, 'fromAddress', normalized, toBlock),
      queryDirection(fetchImpl, url, 'toAddress', normalized, toBlock),
    ])
    const { items, nextBlock } = mergeStreams([sent, received])
    return json({ chainId, address: normalized, items, nextCursor: nextBlock === null ? null : String(nextBlock), provider: 'alchemy' })
  } catch (cause) {
    if (cause instanceof ProxyError) return failure(cause.code, cause.status)
    return failure('upstream', 502)
  }
}

/** Vercel Function entry (Web-standard handler). Reads the key from the server environment only. */
export async function GET(request: Request): Promise<Response> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return handleWalletActivity(request, { apiKey: env?.ALCHEMY_API_KEY })
}
