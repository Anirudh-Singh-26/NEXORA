import { WALLET_NETWORK_CONFIG } from '../wallet/network-config.ts'
/**
 * TON testnet transfer confirmation tracking. Pure helpers: no React, no browser-only imports.
 *
 * TRANSACTION CORRELATION
 * ─────────────────────────────────────────────────────────────────────────────
 * TEP-467 primary (via TonCodec + TrackedMessage):
 *   Match the normalized external-in message hash derived from the TON Connect BOC against the
 *   parsed inMessage.normalizedHash from each on-chain transaction. This is the strongest
 *   per-request attribution when both the wallet and toncenter respond with parseable BOCs.
 *
 * Legacy primary (bodyHash !== null):
 *   Match in_msg.body_hash from toncenter v2 against the SHA-256 hash of the signed external
 *   message body extracted from the TON Connect response BOC via @ton/core. The body contains
 *   seqno, validUntil, recipient, amount and signature — unique per wallet request. This is
 *   strong per-request attribution but is NOT cryptographic proof at the application level: it
 *   relies on the wallet returning a valid parseable BOC and on toncenter reporting body_hash
 *   in a compatible encoding. If either fails, bodyHash is null and the fallback is used.
 *
 * Fallback (bodyHash === null):
 *   Heuristic: in_msg.source === "" (external-in) + matching out_msg recipient address and amount.
 *   NOT definitive: two concurrent transfers from the same address with the same (recipient,
 *   amount) cannot be distinguished. Returns ambiguous=true when ≥2 candidates match.
 *
 * Only transactions with lt > baselineLt are examined in both modes.
 */

import { Address, Cell, loadMessage } from '@ton/core'

export const POLL_INTERVAL_MS = 3_000
export const POLL_MAX_ATTEMPTS = 20        // 20 × 3 s = 60 s ceiling
export const BASELINE_TIMEOUT_MS = 6_000

export type ExecutionResult = 'success' | 'failed' | 'unknown'

export type TonConfirmationResult =
  | { status: 'confirmed';            lt: string; hash: string; executionResult: 'success' }
  | { status: 'on-chain-failed';      lt: string; hash: string; executionResult: 'failed'; stage: 'wallet' | 'delivery' }
  | { status: 'execution-unknown';    lt: string; hash: string; executionResult: 'unknown' }
  | { status: 'confirmation-unknown'; reason: 'timeout' | 'ambiguous' | 'unavailable' }
  | { status: 'confirmation-unknown'; reason: 'delivery-pending'; lt: string; hash: string }

export type MatchResult =
  | { found: true;  lt: string; hash: string; executionResult: ExecutionResult }
  | { found: false; ambiguous: boolean }

export class TonConfirmationError extends Error {
  readonly kind: 'network' | 'rate-limited' | 'auth' | 'http' | 'bad-response'
  constructor(kind: TonConfirmationError['kind'], message: string) {
    super(message)
    this.name = 'TonConfirmationError'
    this.kind = kind
  }
}

/** Testnet explorer transaction link. Only call with a hash obtained from getTransactions. */
export function tonTxExplorerUrl(hash: string): string {
  return `${WALLET_NETWORK_CONFIG.ton.testnet.transactionExplorerUrl}/transaction/${encodeURIComponent(hash)}`
}

/** Parse a decimal-string lt to bigint; throws TonConfirmationError on malformed input. */
export function parseBaselineLt(raw: unknown): bigint {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || raw.length > 30)
    throw new TonConfirmationError('bad-response', `Unexpected last_transaction_id.lt: ${String(raw).slice(0, 40)}`)
  return BigInt(raw)
}

/**
 * Extract the body hash of the signed external message from a TON Connect BOC (base64 string).
 * Returns a 64-character lowercase hex string, or null if the BOC cannot be parsed.
 * Null callers fall back to the (recipient, amount) heuristic.
 */
export function extractBodyHash(boc: string): string | null {
  try {
    const cell = Cell.fromBase64(boc)
    const message = loadMessage(cell.beginParse())
    return [...message.body.hash()].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

/**
 * Compare a toncenter v2 body_hash field (base64 or hex) against our hex-format hash.
 * toncenter v2 typically returns body_hash as base64; this handles both for robustness.
 */
function bodyHashMatches(apiBodyHash: unknown, ourHexHash: string): boolean {
  if (typeof apiBodyHash !== 'string' || apiBodyHash === '') return false
  if (/^[0-9a-fA-F]{64}$/.test(apiBodyHash)) return apiBodyHash.toLowerCase() === ourHexHash
  try {
    const norm = apiBodyHash.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = Array.from(atob(norm), (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    return decoded === ourHexHash
  } catch {
    return false
  }
}

/** Parse an address from the API response (raw or user-friendly). Returns null if unparseable. */
function normalizeApiAddress(raw: unknown): Address | null {
  if (typeof raw !== 'string' || raw === '') return null
  try {
    if (/^-?\d+:/.test(raw)) return Address.parseRaw(raw)
    return Address.parseFriendly(raw).address
  } catch {
    return null
  }
}

/**
 * Classify on-chain execution from a transaction's description field.
 * Returns 'success' only when BOTH phases explicitly report success.
 * Returns 'failed' when EITHER explicitly reports failure.
 * Returns 'unknown' for absent, null, or non-boolean phase data — never assumes success.
 */
export function classifyExecution(description: unknown): ExecutionResult {
  if (typeof description !== 'object' || description === null) return 'unknown'
  const desc = description as Record<string, unknown>
  const cp = (typeof desc.compute_ph === 'object' && desc.compute_ph !== null) ? desc.compute_ph as Record<string, unknown> : null
  const ap = (typeof desc.action_ph  === 'object' && desc.action_ph  !== null) ? desc.action_ph  as Record<string, unknown> : null
  if ((cp !== null && cp.success === false) || (ap !== null && ap.success === false)) return 'failed'
  if (cp !== null && cp.success === true && ap !== null && ap.success === true) return 'success'
  return 'unknown'
}

/**
 * Scan raw getTransactions results for the transaction matching this submitted transfer.
 * See module-level doc for correlation strategy and limitations.
 */
export function findMatchingTx(
  results: unknown[],
  baselineLt: bigint,
  expectedRecipient: string,
  expectedAmountNano: bigint,
  bodyHash: string | null,
): MatchResult {
  const matches: Array<{ lt: string; hash: string; executionResult: ExecutionResult }> = []

  for (const item of results) {
    if (typeof item !== 'object' || item === null) continue
    const tx = item as Record<string, unknown>

    const txId = (typeof tx.transaction_id === 'object' && tx.transaction_id !== null) ? tx.transaction_id as Record<string, unknown> : null
    if (txId === null) continue
    const ltStr   = typeof txId.lt   === 'string' ? txId.lt   : null
    const hashStr = typeof txId.hash === 'string' ? txId.hash : null
    if (ltStr === null || hashStr === null) continue

    let lt: bigint
    try { lt = BigInt(ltStr) } catch { continue }
    if (lt <= baselineLt) continue

    const inMsg = (typeof tx.in_msg === 'object' && tx.in_msg !== null) ? tx.in_msg as Record<string, unknown> : null
    if (inMsg === null) continue

    if (bodyHash !== null) {
      // PRIMARY: body-hash match
      if (!bodyHashMatches(inMsg.body_hash, bodyHash)) continue
    } else {
      // FALLBACK: external-in + (recipient, amount) heuristic
      if (inMsg.source !== '') continue
      if (!Array.isArray(tx.out_msgs) || tx.out_msgs.length === 0) continue
      const outMsg = (typeof tx.out_msgs[0] === 'object' && tx.out_msgs[0] !== null) ? tx.out_msgs[0] as Record<string, unknown> : null
      if (outMsg === null) continue
      const expectedAddr = normalizeApiAddress(expectedRecipient)
      const apiAddr      = normalizeApiAddress(outMsg.destination)
      if (expectedAddr === null || apiAddr === null || !expectedAddr.equals(apiAddr)) continue
      let apiAmount: bigint
      try { apiAmount = BigInt(String(outMsg.value)) } catch { continue }
      if (apiAmount !== expectedAmountNano) continue
    }

    matches.push({ lt: ltStr, hash: hashStr, executionResult: classifyExecution(tx.description) })
  }

  if (matches.length === 0) return { found: false, ambiguous: false }
  if (matches.length >= 2) return { found: false, ambiguous: true }
  return { found: true, ...matches[0] }
}

// ─── Network helpers ──────────────────────────────────────────────────────────

const DEFAULT_BASE = WALLET_NETWORK_CONFIG.ton.testnet.apiBaseUrl

export interface FetchOptions {
  base?: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

async function doFetch(url: string, signal: AbortSignal | undefined, impl: typeof fetch): Promise<unknown> {
  let response: Response
  try {
    response = await impl(url, { method: 'GET', headers: { accept: 'application/json' }, signal, cache: 'no-store', credentials: 'omit' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new TonConfirmationError('network', 'Could not reach the TON testnet data service. Check your connection.')
  }
  if (response.status === 429) throw new TonConfirmationError('rate-limited', 'The TON testnet data service is rate-limiting requests. Wait a moment and try again.')
  if (response.status === 401 || response.status === 403) throw new TonConfirmationError('auth', `The TON testnet data service refused the request (HTTP ${response.status}).`)
  if (!response.ok) throw new TonConfirmationError('http', `The TON testnet data service answered with HTTP ${response.status}.`)
  let body: unknown
  try { body = JSON.parse(await response.text()) } catch {
    throw new TonConfirmationError('bad-response', 'The TON testnet data service returned invalid JSON.')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw new TonConfirmationError('bad-response', 'The TON testnet data service returned an unexpected response shape.')
  const rec = body as Record<string, unknown>
  if (rec.ok !== true) {
    if (rec.code === 429) throw new TonConfirmationError('rate-limited', 'The TON testnet data service is rate-limiting requests.')
    throw new TonConfirmationError('bad-response', 'The TON testnet data service rejected the request.')
  }
  return rec.result
}

/**
 * GET {base}/getAddressInformation?address={address} → baseline lt (0n for new/empty accounts).
 * Rethrows AbortError; throws TonConfirmationError for all other failures.
 */
export async function fetchBaselineLt(address: string, options: FetchOptions = {}): Promise<bigint> {
  const base = options.base ?? DEFAULT_BASE
  const url  = `${base}/getAddressInformation?address=${encodeURIComponent(address)}`
  const result = await doFetch(url, options.signal, options.fetchImpl ?? fetch)
  if (typeof result !== 'object' || result === null)
    throw new TonConfirmationError('bad-response', 'getAddressInformation returned unexpected data.')
  const info   = result as Record<string, unknown>
  const lastTx = info.last_transaction_id
  if (lastTx === null || lastTx === undefined) return 0n
  if (typeof lastTx !== 'object')
    throw new TonConfirmationError('bad-response', 'last_transaction_id has an unexpected shape.')
  const ltRaw = (lastTx as Record<string, unknown>).lt
  if (ltRaw === '0' || ltRaw === 0 || ltRaw === undefined || ltRaw === null) return 0n
  return parseBaselineLt(ltRaw)
}

/**
 * GET {base}/getTransactions?address={address}&limit=10 → raw result array (newest first).
 * Rethrows AbortError; throws TonConfirmationError for all other failures.
 */
export async function fetchRecentTransactions(address: string, options: FetchOptions = {}): Promise<unknown[]> {
  const base = options.base ?? DEFAULT_BASE
  const url  = `${base}/getTransactions?address=${encodeURIComponent(address)}&limit=10`
  const result = await doFetch(url, options.signal, options.fetchImpl ?? fetch)
  if (!Array.isArray(result))
    throw new TonConfirmationError('bad-response', 'getTransactions did not return an array.')
  return result
}

// ─── TEP-467 / TonCodec types and helpers ────────────────────────────────────

/**
 * The identity of a submitted transaction, derived from the TON Connect BOC by confirmation-codec.ts.
 * `hash` is the TEP-467 normalized hash (lowercase hex); `account` is the raw destination address.
 */
export interface TrackedMessage {
  hash: string
  account: string
}

/** Parsed external-in message: hash-matched against on-chain `inMessage`. */
export type ParsedMessage =
  | { kind: 'external-in'; normalizedHash: string; dest: string }
  | { kind: 'internal'; src: string; dest: string; createdLt: string }
  | { kind: 'other' }

export interface ParsedTx {
  lt: string
  hash: string
  inMessage: ParsedMessage | null
  outMessages: ParsedMessage[]
  phases: {
    aborted: boolean
    compute: 'success' | 'failed' | 'skipped'
    action: 'success' | 'failed' | 'none'
    bounced: boolean
  } | null
}

export interface TonCodec {
  parseTransaction(data: unknown): ParsedTx | null
}

/**
 * Classify the sender-side execution of a transaction parsed by TonCodec.
 * Mirrors classifyExecution but operates on the typed ParsedTx from the codec layer.
 * Returns 'success' only when compute AND action both explicitly succeeded.
 * Returns 'failed' when either explicitly failed or the transaction was aborted.
 * Returns 'unknown' when phase data is absent or indeterminate.
 */
export function classifySenderExecution(tx: ParsedTx | null): ExecutionResult {
  if (!tx || !tx.phases) return 'unknown'
  const { compute, action, aborted } = tx.phases
  if (aborted || compute === 'failed' || action === 'failed') return 'failed'
  if (compute === 'success' && action === 'success') return 'success'
  return 'unknown'
}

export interface LookupTransferOptions extends FetchOptions {
  codec: TonCodec
}

export type LookupTransferResult =
  | { state: 'success'; lt: string; hash: string; executionResult: ExecutionResult }
  | { state: 'not-found' }
  | { state: 'unavailable'; message: string }

/**
 * Fetch the wallet account's recent transactions and find the one matching `tracked`
 * using the TEP-467 normalized external-in hash. Only considers transactions with lt > baselineLt.
 * Throws TonConfirmationError (which callers typically convert to 'unavailable').
 */
export async function lookupTransfer(
  tracked: TrackedMessage,
  baselineLt: bigint,
  options: LookupTransferOptions,
): Promise<LookupTransferResult> {
  let rows: unknown[]
  try {
    rows = await fetchRecentTransactions(tracked.account, options)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    const message = error instanceof TonConfirmationError ? error.message : 'Could not reach the TON testnet data service.'
    return { state: 'unavailable', message }
  }

  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const item = row as Record<string, unknown>

    // Extract lt
    const txId = (typeof item.transaction_id === 'object' && item.transaction_id !== null) ? item.transaction_id as Record<string, unknown> : null
    if (!txId) continue
    const ltStr = typeof txId.lt === 'string' ? txId.lt : null
    const hashStr = typeof txId.hash === 'string' ? txId.hash : null
    if (!ltStr || !hashStr) continue
    let lt: bigint
    try { lt = BigInt(ltStr) } catch { continue }
    if (lt <= baselineLt) continue

    // Try codec-based BOC match first
    if (typeof item.data === 'string') {
      const parsed = options.codec.parseTransaction(item.data)
      if (parsed && parsed.inMessage?.kind === 'external-in' && parsed.inMessage.normalizedHash === tracked.hash) {
        return { state: 'success', lt: ltStr, hash: parsed.hash, executionResult: classifySenderExecution(parsed) }
      }
    }
  }

  return { state: 'not-found' }
}
