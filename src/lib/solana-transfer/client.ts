/**
 * Browser client for NEXORA's /api/solana-transfer proxy (prepare, relay, status). No keys, nothing signed here.
 * Every response is validated and must say `cluster: "devnet"`; a response that does not is treated as malformed, so
 * data from any other cluster can never reach the transfer flow. Failures throw TransferError with a fixed kind.
 */
import { SOLANA_DEVNET_GENESIS_HASH } from '../network/testnet.ts'
import { SOLANA_SIGNATURE_PATTERN } from '../wallet-activity/chains.ts'
import { isSolanaAddress } from '../solana-balance/solana-balance.ts'
import { TransferError, type TransferFailureKind } from './errors.ts'

export interface PreparedTransfer {
  balance: bigint
  fee: bigint
  rentExemptMinimum: bigint
  recipientBalance: bigint | null
  blockhash: string
  lastValidBlockHeight: number
}

export type SignatureState = 'processed' | 'confirmed' | 'finalized' | 'failed' | 'not-found' | 'expired'

export interface ClientOptions { signal?: AbortSignal; fetchImpl?: typeof fetch; endpoint?: string; timeoutMs?: number }

const ENDPOINT = '/api/solana-transfer'
const LAMPORTS_RE = /^(0|[1-9][0-9]{0,18})$/
const SERVER_KINDS: Record<string, TransferFailureKind> = {
  'rate-limited': 'rate-limited', 'wrong-cluster': 'network-mismatch', 'provider-auth': 'rpc-failure', upstream: 'rpc-failure', 'not-configured': 'rpc-failure', 'invalid-request': 'rejected',
}
const REJECT_REASONS: Record<string, TransferFailureKind> = {
  'blockhash-expired': 'blockhash-expired', 'insufficient-funds': 'insufficient-funds', 'insufficient-rent': 'insufficient-rent', 'invalid-signature': 'invalid-signature', rejected: 'rejected',
}

async function request(query: string, init: RequestInit, options: ClientOptions): Promise<unknown> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, options.timeoutMs ?? 25_000)
  const onAbort = () => controller.abort()
  if (options.signal?.aborted) { clearTimeout(timer); throw new TransferError('timeout') }
  options.signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await (options.fetchImpl ?? fetch)(`${options.endpoint ?? ENDPOINT}${query}`, { ...init, signal: controller.signal })
    const contentType = response.headers.get('content-type') ?? ''
    // The SPA fallback serves index.html for unknown paths: the proxy is not deployed or not running.
    if (!contentType.includes('json')) throw new TransferError('rpc-failure')
    let body: unknown
    try { body = await response.json() } catch { throw new TransferError('rpc-failure') }
    if (!response.ok) {
      const error = (body as { error?: { code?: unknown; reason?: unknown } } | null)?.error
      if (error?.code === 'rejected') throw new TransferError(typeof error.reason === 'string' && REJECT_REASONS[error.reason] ? REJECT_REASONS[error.reason] : 'rejected')
      throw new TransferError(typeof error?.code === 'string' && SERVER_KINDS[error.code] ? SERVER_KINDS[error.code] : 'rpc-failure')
    }
    return body
  } catch (cause) {
    if (cause instanceof TransferError) throw cause
    throw new TransferError(timedOut ? 'timeout' : options.signal?.aborted ? 'timeout' : 'rpc-failure')
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

function lamports(value: unknown): bigint {
  if (typeof value !== 'string' || !LAMPORTS_RE.test(value)) throw new TransferError('rpc-failure')
  return BigInt(value)
}

function assertDevnetBody(body: unknown): Record<string, unknown> {
  const root = body as Record<string, unknown> | null
  if (!root || typeof root !== 'object' || root.cluster !== 'devnet') throw new TransferError('network-mismatch')
  return root
}

/** Balance, fee, rent minimum, optional recipient balance and a fresh blockhash, all read from Devnet. */
export async function fetchPrepare(address: string, recipient: string | null, options: ClientOptions = {}): Promise<PreparedTransfer> {
  if (!isSolanaAddress(address) || (recipient !== null && !isSolanaAddress(recipient))) throw new TransferError('rejected')
  const query = new URLSearchParams({ action: 'prepare', address })
  if (recipient) query.set('recipient', recipient)
  const root = assertDevnetBody(await request(`?${query}`, { headers: { accept: 'application/json' } }, options))
  if (root.genesisHash !== SOLANA_DEVNET_GENESIS_HASH || root.address !== address) throw new TransferError('network-mismatch')
  const { blockhash, lastValidBlockHeight } = root
  if (typeof blockhash !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(blockhash) || typeof lastValidBlockHeight !== 'number' || !Number.isSafeInteger(lastValidBlockHeight)) throw new TransferError('rpc-failure')
  return {
    balance: lamports(root.balanceLamports), fee: lamports(root.feeLamports), rentExemptMinimum: lamports(root.rentExemptMinimumLamports),
    recipientBalance: root.recipientLamports === null ? null : lamports(root.recipientLamports), blockhash, lastValidBlockHeight,
  }
}

/** Relays an already-signed transaction (base64) to Devnet and returns its signature. */
export async function relaySignedTransaction(base64: string, options: ClientOptions = {}): Promise<string> {
  const root = assertDevnetBody(await request('', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ transaction: base64 }) }, options))
  if (typeof root.signature !== 'string' || !SOLANA_SIGNATURE_PATTERN.test(root.signature)) throw new TransferError('rpc-failure')
  return root.signature
}

export async function fetchSignatureState(signature: string, lastValidBlockHeight: number | null, options: ClientOptions = {}): Promise<SignatureState> {
  if (!SOLANA_SIGNATURE_PATTERN.test(signature)) throw new TransferError('rejected')
  const query = new URLSearchParams({ action: 'status', signature })
  if (lastValidBlockHeight !== null) query.set('lastValidBlockHeight', String(lastValidBlockHeight))
  const body = await request(`?${query}`, { headers: { accept: 'application/json' } }, options) as { signature?: unknown; state?: unknown } | null
  const state = body?.state
  if (body?.signature !== signature || (state !== 'processed' && state !== 'confirmed' && state !== 'finalized' && state !== 'failed' && state !== 'not-found' && state !== 'expired')) throw new TransferError('rpc-failure')
  return state
}
