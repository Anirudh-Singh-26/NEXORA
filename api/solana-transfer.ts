/**
 * Server half of NEXORA's native SOL transfer on Solana DEVNET. The wallet (Phantom via Reown) builds nothing secret and
 * signs in its own UI; this endpoint only supplies chain data and relays the ALREADY-SIGNED transaction. It never sees a
 * seed phrase or private key, and it cannot sign. The Alchemy key (ALCHEMY_API_KEY) stays in this server process.
 *
 *   GET  ?action=prepare&address=<sender>[&recipient=<address>]
 *        -> { cluster, balanceLamports, feeLamports, rentExemptMinimumLamports, recipientLamports | null,
 *             blockhash, lastValidBlockHeight, provider }
 *        Verifies the answering cluster's genesis hash is Devnet's before returning anything.
 *   POST { transaction: <base64 signed transaction> }
 *        -> { signature }   Relays with `sendTransaction` (preflight on). Devnet's genesis hash is verified first.
 *   GET  ?action=status&signature=<sig>[&lastValidBlockHeight=<n>]
 *        -> { signature, state: "processed" | "confirmed" | "finalized" | "failed" | "not-found" | "expired" }
 *
 * Devnet only: there is no mainnet URL in this code path, a transaction signed against a Devnet blockhash cannot land on
 * mainnet, and the genesis check refuses to relay if a provider ever answered from another cluster.
 * Responses: JSON, or { error: { code, message } } with an HTTP status. Messages are fixed strings (no URL, key or raw
 * provider text). A rejected relay carries a `reason` from a fixed list so the UI can explain what happened.
 */
import { isSolanaAddress } from '../src/lib/solana-balance/solana-balance.ts'
import { SOLANA_DEVNET_GENESIS_HASH } from '../src/lib/network/testnet.ts'
import { SOLANA_SIGNATURE_PATTERN } from '../src/lib/wallet-activity/chains.ts'
import { assertDevnet, devnetResult, failure, json, lamportsString, ProxyError, type RpcOptions } from './_solana-devnet-rpc.ts'

/** Base fee of a legacy transaction with one signature (5,000 lamports). Priority fees are not added by NEXORA. */
export const BASE_FEE_LAMPORTS = 5000
/** Rent-exempt minimum of a zero-data system account; used only if the RPC does not answer. */
export const FALLBACK_RENT_EXEMPT_LAMPORTS = 890_880
/** A transaction packet is at most 1232 bytes; base64 inflates it by 4/3. */
export const MAX_TX_BYTES = 1232
const MAX_BODY_CHARS = 4096
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

export type RejectReason = 'blockhash-expired' | 'insufficient-funds' | 'insufficient-rent' | 'invalid-signature' | 'rejected'
export interface HandlerOptions { apiKey?: string; fetchImpl?: typeof fetch }

/** Maps a (server-side only) JSON-RPC error message from sendTransaction to a fixed reason. */
export function classifyRejection(rpcMessage: string | null): RejectReason {
  const text = (rpcMessage ?? '').toLowerCase()
  if (/blockhash not found|block height exceeded|blockhash.*expired/.test(text)) return 'blockhash-expired'
  if (/insufficient funds for rent|insufficientfundsforrent/.test(text)) return 'insufficient-rent'
  if (/insufficient (funds|lamports)|custom program error: 0x1\b|attempt to debit an account but found no record of a prior credit|insufficientfunds/.test(text)) return 'insufficient-funds'
  if (/signature verification|sigverify|missing signature|invalid signature/.test(text)) return 'invalid-signature'
  return 'rejected'
}

/** Decodes and sanity-checks a base64 signed transaction: size, at least one non-zero signature. Returns the byte length. */
export function checkSignedTransaction(base64: unknown): number {
  if (typeof base64 !== 'string' || base64.length === 0 || base64.length > Math.ceil(MAX_TX_BYTES / 3) * 4 || !BASE64_RE.test(base64) || base64.length % 4 !== 0) throw new ProxyError('invalid-request', 400)
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length < 66 || bytes.length > MAX_TX_BYTES) throw new ProxyError('invalid-request', 400)
  // Wire format: shortvec signature count, then 64-byte signatures. NEXORA's transfer has exactly one signer.
  const count = bytes[0]
  if (count < 1 || count > 8 || bytes.length < 1 + count * 64) throw new ProxyError('invalid-request', 400)
  if (bytes.subarray(1, 65).every((byte) => byte === 0)) throw new ProxyError('invalid-request', 400) // unsigned
  return bytes.length
}

async function handlePrepare(search: URLSearchParams, rpc: RpcOptions): Promise<Response> {
  const addresses = search.getAll('address')
  const recipients = search.getAll('recipient')
  const address = addresses[0] ?? ''
  const recipient = recipients[0] ?? null
  if (addresses.length !== 1 || !isSolanaAddress(address) || recipients.length > 1 || (recipient !== null && !isSolanaAddress(recipient))) return failure('invalid-request', 400)

  await assertDevnet(rpc)
  const [balance, blockhash, rent, recipientBalance] = await Promise.all([
    devnetResult('getBalance', [address, { commitment: 'confirmed' }], rpc),
    devnetResult('getLatestBlockhash', [{ commitment: 'confirmed' }], rpc),
    devnetResult('getMinimumBalanceForRentExemption', [0], rpc).then((r) => r.result).catch(() => FALLBACK_RENT_EXEMPT_LAMPORTS),
    recipient ? devnetResult('getBalance', [recipient, { commitment: 'confirmed' }], rpc) : Promise.resolve(null),
  ])
  const balanceValue = (balance.result as { value?: unknown } | null)?.value
  const latest = (blockhash.result as { value?: { blockhash?: unknown; lastValidBlockHeight?: unknown } } | null)?.value
  if (typeof latest?.blockhash !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(latest.blockhash) || typeof latest.lastValidBlockHeight !== 'number' || !Number.isSafeInteger(latest.lastValidBlockHeight)) throw new ProxyError('upstream', 502)
  return json({
    cluster: 'devnet',
    genesisHash: SOLANA_DEVNET_GENESIS_HASH,
    address,
    balanceLamports: lamportsString(balanceValue),
    feeLamports: String(BASE_FEE_LAMPORTS),
    rentExemptMinimumLamports: lamportsString(rent),
    recipientLamports: recipientBalance ? lamportsString((recipientBalance.result as { value?: unknown } | null)?.value) : null,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    provider: balance.provider,
  })
}

async function handleSend(request: Request, rpc: RpcOptions): Promise<Response> {
  const text = await request.text()
  if (text.length > MAX_BODY_CHARS) return failure('invalid-request', 400)
  let body: unknown
  try { body = JSON.parse(text) } catch { return failure('invalid-request', 400) }
  const transaction = (body as { transaction?: unknown } | null)?.transaction
  checkSignedTransaction(transaction)

  await assertDevnet(rpc)
  try {
    const { result } = await devnetResult('sendTransaction', [transaction, { encoding: 'base64', preflightCommitment: 'confirmed', skipPreflight: false, maxRetries: 3 }], rpc)
    if (typeof result !== 'string' || !SOLANA_SIGNATURE_PATTERN.test(result)) throw new ProxyError('upstream', 502)
    return json({ cluster: 'devnet', signature: result })
  } catch (cause) {
    // A JSON-RPC rejection (simulation failed, expired blockhash, ...) is the user's transaction being refused, not an outage.
    if (cause instanceof ProxyError && cause.code === 'upstream' && cause.rpcMessage !== null) {
      const reason = classifyRejection(cause.rpcMessage)
      return json({ error: { code: 'rejected', reason, message: 'The network refused the transaction.' } }, 422)
    }
    throw cause
  }
}

async function handleStatus(search: URLSearchParams, rpc: RpcOptions): Promise<Response> {
  const signatures = search.getAll('signature')
  const signature = signatures[0] ?? ''
  const lvbhText = search.get('lastValidBlockHeight')
  const lastValid = lvbhText === null ? null : /^[0-9]{1,15}$/.test(lvbhText) ? Number(lvbhText) : NaN
  if (signatures.length !== 1 || !SOLANA_SIGNATURE_PATTERN.test(signature) || (lastValid !== null && !Number.isSafeInteger(lastValid))) return failure('invalid-request', 400)

  const { result } = await devnetResult('getSignatureStatuses', [[signature], { searchTransactionHistory: true }], rpc)
  const value = (result as { value?: unknown[] } | null)?.value
  if (!Array.isArray(value) || value.length !== 1) throw new ProxyError('upstream', 502)
  const entry = value[0] as { err?: unknown; confirmationStatus?: unknown } | null
  if (entry === null || entry === undefined) {
    // Unknown signature: still pending until its blockhash can no longer be used, after which it will never land.
    if (lastValid !== null) {
      const { result: height } = await devnetResult('getBlockHeight', [{ commitment: 'confirmed' }], rpc)
      if (typeof height === 'number' && height > lastValid) return json({ signature, state: 'expired' })
    }
    return json({ signature, state: 'not-found' })
  }
  if (typeof entry !== 'object') throw new ProxyError('upstream', 502)
  if (entry.err !== null && entry.err !== undefined) return json({ signature, state: 'failed' })
  const level = entry.confirmationStatus
  if (level !== 'processed' && level !== 'confirmed' && level !== 'finalized') return json({ signature, state: 'processed' })
  return json({ signature, state: level })
}

export async function handleSolanaTransfer(request: Request, options: HandlerOptions = {}): Promise<Response> {
  const rpc: RpcOptions = { apiKey: options.apiKey, fetchImpl: options.fetchImpl }
  try {
    if (request.method === 'POST') return await handleSend(request, rpc)
    if (request.method !== 'GET') return failure('method-not-allowed', 405)
    const search = new URL(request.url).searchParams
    const action = search.get('action')
    if (action === 'prepare') return await handlePrepare(search, rpc)
    if (action === 'status') return await handleStatus(search, rpc)
    return failure('invalid-request', 400)
  } catch (cause) {
    if (cause instanceof ProxyError) return failure(cause.code, cause.status)
    return failure('upstream', 502)
  }
}

/** Vercel Function entry (Web-standard handlers). Reads the key from the server environment only. */
function env() { return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env }
export async function GET(request: Request): Promise<Response> { return handleSolanaTransfer(request, { apiKey: env()?.ALCHEMY_API_KEY }) }
export async function POST(request: Request): Promise<Response> { return handleSolanaTransfer(request, { apiKey: env()?.ALCHEMY_API_KEY }) }
