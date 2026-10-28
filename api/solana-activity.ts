/**
 * GET /api/solana-activity?address=<base58 public key>[&cursor=<signature>]
 *
 * Read-only proxy for a Solana wallet's recent DEVNET transactions. Two standard JSON-RPC methods:
 *   1. `getSignaturesForAddress` (newest first, paginated with `before`): signature, slot, block time, error, confirmation.
 *   2. `getTransaction` (jsonParsed) per signature, to derive direction / counterparty / SOL amount / fee when that is
 *      reliable (see src/lib/wallet-activity/solana-details.ts). A transaction whose details cannot be read keeps its
 *      row with `details: null`; it never fails the whole page and never gets an invented amount.
 *
 * Devnet only. Provider order: Alchemy's Devnet host when ALCHEMY_API_KEY is set (server-only, never sent to the
 * browser), then the public Devnet RPC (no key needed). There is no mainnet endpoint in this file. The response always
 * says `cluster: "devnet"`. Nothing is signed or sent.
 *
 * Responses: 200 { cluster, address, items[], nextCursor, provider } or { error: { code, message } } with an HTTP status.
 */
import { isSolanaAddress } from '../src/lib/solana-balance/solana-balance.ts'
import { SOLANA_SIGNATURE_PATTERN } from '../src/lib/wallet-activity/chains.ts'
import { parseTransactionDetails } from '../src/lib/wallet-activity/solana-details.ts'
import type { SolanaActivityItem } from '../src/lib/wallet-activity/types.ts'
import { devnetResult, failure, json, ProxyError, type RpcOptions } from './_solana-devnet-rpc.ts'

export const PAGE_SIZE = 15
/** Public Devnet RPC rate limits are tight: read details a few at a time, not all at once. */
const DETAIL_CONCURRENCY = 4

export type { ErrorCode } from './_solana-devnet-rpc.ts'
export interface HandlerOptions { apiKey?: string; fetchImpl?: typeof fetch }

const CONFIRMATIONS = ['processed', 'confirmed', 'finalized'] as const

/** Validates a getSignaturesForAddress result. A malformed envelope throws; malformed rows are dropped. */
export function parseSignatures(result: unknown): SolanaActivityItem[] {
  if (!Array.isArray(result)) throw new ProxyError('upstream', 502)
  const seen = new Set<string>()
  const items: SolanaActivityItem[] = []
  for (const entry of result as Array<Record<string, unknown>>) {
    if (!entry || typeof entry !== 'object') continue
    const signature = entry.signature
    if (typeof signature !== 'string' || !SOLANA_SIGNATURE_PATTERN.test(signature) || seen.has(signature)) continue
    if (typeof entry.slot !== 'number' || !Number.isSafeInteger(entry.slot) || entry.slot < 0) continue
    seen.add(signature)
    const blockTime = typeof entry.blockTime === 'number' && Number.isSafeInteger(entry.blockTime) && entry.blockTime > 0 ? entry.blockTime : null
    // `err` is null for success and an object/string for failure; when the field is absent the status is unknown.
    const status = entry.err === null ? 'success' : entry.err !== undefined ? 'failed' : null
    const confirmation = CONFIRMATIONS.find((level) => level === entry.confirmationStatus) ?? null
    items.push({ signature, slot: entry.slot, blockTime, status, confirmation, details: null })
  }
  return items
}

/** Reads details for every item, `DETAIL_CONCURRENCY` at a time. Any per-transaction failure leaves `details: null`. */
async function attachDetails(items: SolanaActivityItem[], wallet: string, options: RpcOptions): Promise<SolanaActivityItem[]> {
  const out = items.map((item) => ({ ...item }))
  let next = 0
  async function worker() {
    while (next < out.length) {
      const item = out[next++]
      try {
        const { result } = await devnetResult('getTransaction', [item.signature, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }], options)
        item.details = parseTransactionDetails(result, wallet)
        // The transaction's own error field is authoritative when the signature listing did not report one.
        if (item.status === null && result && typeof result === 'object') {
          const err = (result as { meta?: { err?: unknown } }).meta?.err
          if (err === null) item.status = 'success'
          else if (err !== undefined) item.status = 'failed'
        }
      } catch { item.details = null }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, out.length) }, worker))
  return out
}

export async function handleSolanaActivity(request: Request, options: HandlerOptions = {}): Promise<Response> {
  if (request.method !== 'GET') return failure('method-not-allowed', 405)
  const search = new URL(request.url).searchParams
  const addresses = search.getAll('address')
  const cursors = search.getAll('cursor')
  const address = addresses[0] ?? ''
  const cursor = cursors[0] ?? null
  if (addresses.length !== 1 || !isSolanaAddress(address) || cursors.length > 1 || (cursor !== null && !SOLANA_SIGNATURE_PATTERN.test(cursor))) return failure('invalid-request', 400)

  const rpc: RpcOptions = { apiKey: options.apiKey, fetchImpl: options.fetchImpl }
  const rpcOptions: Record<string, unknown> = { limit: PAGE_SIZE, commitment: 'confirmed' }
  if (cursor) rpcOptions.before = cursor
  try {
    const { result, provider } = await devnetResult('getSignaturesForAddress', [address, rpcOptions], rpc)
    const signatures = parseSignatures(result)
    const items = await attachDetails(signatures, address, rpc)
    // A full page means older rows may exist; a short page is the end of history.
    const nextCursor = signatures.length >= PAGE_SIZE ? signatures[signatures.length - 1].signature : null
    return json({ cluster: 'devnet', address, items, nextCursor, provider })
  } catch (cause) {
    if (cause instanceof ProxyError) return failure(cause.code, cause.status)
    return failure('upstream', 502)
  }
}

/** Vercel Function entry (Web-standard handler). Reads the key from the server environment only. */
export async function GET(request: Request): Promise<Response> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  try {
    return await handleSolanaActivity(request, { apiKey: env?.ALCHEMY_API_KEY })
  } catch (cause) {
    // Never let an unexpected exception become a bare platform 500: log only the error class (no message, URL or key).
    console.error('solana-activity: unexpected failure', cause instanceof Error ? cause.name : typeof cause)
    return failure('upstream', 502)
  }
}
