import { bytesToHex, decodeTronAddress, hexToBytes, sha256 } from './encoding.ts'
import { SUN_PER_TRX } from './format.ts'
import { isTxId, SHASTA_API_URL, type TronNetworkIdentity } from './network.ts'

/**
 * Native TRX transfer on Shasta: amount/recipient validation, the "may we send" gate, building and independently
 * verifying the unsigned transaction, broadcasting the wallet-signed one, and reading its status. Every request goes
 * to the fixed Shasta endpoint; no function accepts a host. Nothing here holds or sees a private key.
 */

/* ----------------------------------------------------------------- amounts */

/** Largest amount sent (2^53 - 1 SUN) so the JSON number the node receives is exact. */
export const MAX_SEND_SUN = BigInt(Number.MAX_SAFE_INTEGER)

export type AmountProblem = 'empty' | 'format' | 'precision' | 'zero' | 'too-large'
export type AmountResult = { ok: true; sun: bigint } | { ok: false; problem: AmountProblem; message: string }

const AMOUNT_MESSAGE: Record<AmountProblem, string> = {
  empty: 'Enter an amount in TRX.',
  format: 'Use digits and an optional decimal point, for example 1.5. No signs, commas, spaces or exponents.',
  precision: 'TRX has at most 6 decimal places (1 TRX = 1,000,000 SUN).',
  zero: 'The amount must be greater than zero.',
  'too-large': 'That amount is larger than NEXORA can send in one transfer.',
}

function amountFail(problem: AmountProblem): AmountResult {
  return { ok: false, problem, message: AMOUNT_MESSAGE[problem] }
}

/** Parse a decimal TRX string into integer SUN using string/bigint arithmetic only (never floating point). */
export function parseTrxAmount(input: string): AmountResult {
  const text = input.trim()
  if (text === '') return amountFail('empty')
  if (/^\d+\.\d{7,}$/.test(text)) return amountFail('precision')
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text)
  if (!match) return amountFail('format')
  const sun = BigInt(match[1]) * SUN_PER_TRX + BigInt((match[2] ?? '').padEnd(6, '0') || '0')
  if (sun === 0n) return amountFail('zero')
  if (sun > MAX_SEND_SUN) return amountFail('too-large')
  return { ok: true, sun }
}

/* --------------------------------------------------------------- recipient */

export type RecipientProblem = 'empty' | 'invalid' | 'self'

export function validateRecipient(recipient: string, sender: string | null): { ok: true } | { ok: false; problem: RecipientProblem; message: string } {
  const text = recipient.trim()
  if (text === '') return { ok: false, problem: 'empty', message: 'Enter a recipient TRON address.' }
  if (decodeTronAddress(text) === null) return { ok: false, problem: 'invalid', message: 'That is not a valid TRON address (it should start with T and pass its checksum).' }
  if (sender !== null && text === sender) return { ok: false, problem: 'self', message: 'You cannot send to your own connected address.' }
  return { ok: true }
}

/** Available-balance check. NOT a fee estimate: fees are not calculated here. */
export function checkSufficientBalance(balanceSun: bigint, amountSun: bigint): { ok: true; leavesNothingForFees: boolean } | { ok: false; message: string } {
  if (amountSun > balanceSun) return { ok: false, message: 'The amount is more than your available Shasta TRX balance.' }
  return { ok: true, leavesNothingForFees: amountSun === balanceSun }
}

/* ------------------------------------------------------------ network gate */

export type GateBlock = 'not-connected' | 'network-unverified' | 'not-shasta' | 'account-changed'
export type GateResult = { ok: true } | { ok: false; reason: GateBlock; message: string }

/**
 * The one rule for "may a Shasta transfer proceed right now". Used by the form and again, with a FRESH wallet
 * reading, immediately before the wallet is asked to sign.
 */
export function evaluateSendGate(input: { connected: boolean; address: string | null; expectedSender: string | null; identity: TronNetworkIdentity | null }): GateResult {
  if (!input.connected || !input.address) return { ok: false, reason: 'not-connected', message: 'Connect TronLink first.' }
  if (input.expectedSender !== null && input.address !== input.expectedSender) {
    return { ok: false, reason: 'account-changed', message: 'The active TronLink account changed. Nothing was sent; review the form and try again.' }
  }
  if (!input.identity) return { ok: false, reason: 'network-unverified', message: 'The wallet’s network is not verified yet, so nothing can be sent.' }
  if (!input.identity.verifiedShasta) {
    return { ok: false, reason: input.identity.kind === 'unknown' ? 'network-unverified' : 'not-shasta', message: 'Sending is only available when TronLink is positively verified on the Shasta testnet.' }
  }
  return { ok: true }
}

/* ------------------------------------------------------------------- types */

export interface TransferContractJson {
  type: string
  parameter: { value: { owner_address?: string; to_address?: string; amount?: number }; type_url?: string }
}

/** The subset of a TRON transaction object this module reads. Extra fields are passed through untouched. */
export interface TronTx {
  visible?: boolean
  txID: string
  raw_data: { contract: TransferContractJson[]; expiration: number; timestamp?: number; [key: string]: unknown }
  raw_data_hex: string
  signature?: string[]
  [key: string]: unknown
}

export class TransferError extends Error {
  readonly kind: 'invalid-input' | 'network' | 'http' | 'rejected-by-node' | 'mismatch' | 'expired' | 'wallet' | 'declined'
  constructor(kind: TransferError['kind'], message: string) {
    super(message)
    this.name = 'TransferError'
    this.kind = kind
  }
}

export interface RpcOptions { signal?: AbortSignal; fetchImpl?: typeof fetch }

async function postShasta(path: string, body: unknown, options: RpcOptions): Promise<Record<string, unknown>> {
  const doFetch = options.fetchImpl ?? fetch
  let response: Response
  try {
    response = await doFetch(`${SHASTA_API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
      cache: 'no-store',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new TransferError('network', 'Could not reach the Shasta node. Check your connection and try again.')
  }
  if (!response.ok) throw new TransferError('http', `The Shasta node answered with HTTP ${response.status}.`)
  let parsed: unknown
  try { parsed = await response.json() } catch { throw new TransferError('http', 'The Shasta node returned a response that is not valid JSON.') }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new TransferError('http', 'The Shasta node returned an unexpected response.')
  return parsed as Record<string, unknown>
}

/* ----------------------------------------------- verifying unsigned bytes */

interface RawTransfer { contractType: number; owner: Uint8Array; to: Uint8Array; amount: bigint; expiration: bigint; contractCount: number; hasMemo: boolean }

function readVarint(bytes: Uint8Array, start: number): { value: bigint; next: number } | null {
  let value = 0n
  let shift = 0n
  let i = start
  while (i < bytes.length) {
    const byte = bytes[i]
    value |= BigInt(byte & 0x7f) << shift
    i += 1
    if ((byte & 0x80) === 0) return { value, next: i }
    shift += 7n
    if (shift > 70n) return null
  }
  return null
}

type Field = { field: number; wire: number; varint?: bigint; bytes?: Uint8Array }

function readFields(bytes: Uint8Array): Field[] | null {
  const fields: Field[] = []
  let i = 0
  while (i < bytes.length) {
    const key = readVarint(bytes, i)
    if (!key) return null
    i = key.next
    const field = Number(key.value >> 3n)
    const wire = Number(key.value & 7n)
    if (wire === 0) {
      const v = readVarint(bytes, i)
      if (!v) return null
      fields.push({ field, wire, varint: v.value }); i = v.next
    } else if (wire === 2) {
      const len = readVarint(bytes, i)
      if (!len) return null
      const end = len.next + Number(len.value)
      if (end > bytes.length) return null
      fields.push({ field, wire, bytes: bytes.slice(len.next, end) }); i = end
    } else if (wire === 1) { i += 8 } else if (wire === 5) { i += 4 } else return null
  }
  return i === bytes.length ? fields : null
}

/** Decode the protobuf in `raw_data_hex` far enough to read a single TransferContract. Null if it is anything else. */
export function parseRawTransfer(rawHex: string): RawTransfer | null {
  const bytes = hexToBytes(rawHex)
  if (!bytes) return null
  const top = readFields(bytes)
  if (!top) return null
  const contracts = top.filter((f) => f.field === 11 && f.bytes)
  const expiration = top.find((f) => f.field === 8)?.varint ?? 0n
  const hasMemo = top.some((f) => f.field === 10)
  if (contracts.length !== 1 || !contracts[0].bytes) return { contractType: -1, owner: new Uint8Array(), to: new Uint8Array(), amount: 0n, expiration, contractCount: contracts.length, hasMemo }
  const contract = readFields(contracts[0].bytes)
  const type = contract?.find((f) => f.field === 1)?.varint
  const any = contract?.find((f) => f.field === 2)?.bytes
  const value = any ? readFields(any)?.find((f) => f.field === 2)?.bytes : undefined
  const inner = value ? readFields(value) : null
  if (type === undefined || !inner) return null
  return {
    contractType: Number(type),
    owner: inner.find((f) => f.field === 1)?.bytes ?? new Uint8Array(),
    to: inner.find((f) => f.field === 2)?.bytes ?? new Uint8Array(),
    amount: inner.find((f) => f.field === 3)?.varint ?? 0n,
    expiration,
    contractCount: 1,
    hasMemo,
  }
}

const TRANSFER_CONTRACT_TYPE = 1

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export interface TransferIntent { sender: string; recipient: string; sun: bigint }

/**
 * Do not trust the node: confirm the transaction we are about to hand to the wallet really is ONE plain TRX transfer
 * of exactly this amount, from this sender, to this recipient, and that its ID is the SHA-256 of its raw bytes.
 * Throws TransferError('mismatch') otherwise.
 */
export function verifyUnsignedTransfer(tx: TronTx, intent: TransferIntent): void {
  const fail = (): never => { throw new TransferError('mismatch', 'The Shasta node returned a transaction that does not match your request. Nothing was sent.') }
  const sender = decodeTronAddress(intent.sender)
  const recipient = decodeTronAddress(intent.recipient)
  if (!sender || !recipient) return fail()
  const rawBytes = hexToBytes(tx.raw_data_hex ?? '')
  if (!rawBytes || tx.txID !== bytesToHex(sha256(rawBytes))) return fail()
  const raw = parseRawTransfer(tx.raw_data_hex)
  if (!raw || raw.contractCount !== 1 || raw.hasMemo || raw.contractType !== TRANSFER_CONTRACT_TYPE) return fail()
  if (!sameBytes(raw.owner, sender) || !sameBytes(raw.to, recipient) || raw.amount !== intent.sun) return fail()
  // The readable JSON must agree with the signed bytes too.
  const json = tx.raw_data?.contract
  if (!Array.isArray(json) || json.length !== 1 || json[0].type !== 'TransferContract') return fail()
  const value = json[0].parameter?.value
  const wants = (field: string | undefined, address: string, payload: Uint8Array) => field === address || (typeof field === 'string' && field.toLowerCase() === bytesToHex(payload))
  if (!value || !wants(value.owner_address, intent.sender, sender) || !wants(value.to_address, intent.recipient, recipient) || BigInt(value.amount ?? -1) !== intent.sun) return fail()
  if (Number(raw.expiration) !== tx.raw_data.expiration) return fail()
}

/* ------------------------------------------------------------- build / send */

/** Ask the Shasta node to build (never sign) a TRX transfer, then verify it byte-for-byte. */
export async function buildShastaTransfer(intent: TransferIntent, options: RpcOptions = {}): Promise<TronTx> {
  const check = validateRecipient(intent.recipient, intent.sender)
  if (!check.ok) throw new TransferError('invalid-input', check.message)
  if (intent.sun <= 0n || intent.sun > MAX_SEND_SUN) throw new TransferError('invalid-input', AMOUNT_MESSAGE['too-large'])
  const body = await postShasta('/wallet/createtransaction', { owner_address: intent.sender, to_address: intent.recipient, amount: Number(intent.sun), visible: true }, options)
  if (typeof body.Error === 'string') throw new TransferError('rejected-by-node', 'The Shasta node could not build this transfer. Check the recipient and amount.')
  const tx = body as unknown as TronTx
  verifyUnsignedTransfer(tx, intent)
  return tx
}

/** The wallet may return a new object; refuse anything but the exact transaction we verified, now carrying signatures. */
export function verifySignedMatches(unsigned: TronTx, signed: TronTx): void {
  const ok = signed && signed.txID === unsigned.txID && signed.raw_data_hex === unsigned.raw_data_hex && Array.isArray(signed.signature) && signed.signature.length > 0 && signed.signature.every((s) => typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s))
  if (!ok) throw new TransferError('mismatch', 'The wallet returned a transaction that differs from the one NEXORA prepared. It was not broadcast.')
}

function decodeNodeMessage(hex: unknown): string {
  if (typeof hex !== 'string') return ''
  const bytes = hexToBytes(hex)
  return bytes ? new TextDecoder().decode(bytes).slice(0, 160) : hex.slice(0, 160)
}

/** Broadcast a wallet-signed transaction to Shasta. Returns the transaction ID only when the node accepts it. */
export async function broadcastShastaTransaction(signed: TronTx, options: RpcOptions = {}): Promise<{ txId: string }> {
  if (signed.raw_data.expiration <= Date.now()) throw new TransferError('expired', 'The transaction expired while waiting for wallet approval. Nothing was sent; please try again.')
  const body = await postShasta('/wallet/broadcasttransaction', signed, options)
  if (body.result === true) return { txId: signed.txID }
  const code = typeof body.code === 'string' ? body.code : 'UNKNOWN'
  const detail = decodeNodeMessage(body.message)
  throw new TransferError('rejected-by-node', `Shasta rejected the transaction (${code})${detail ? `: ${detail}` : ''}.`)
}

/* ----------------------------------------------------------------- status */

export type TxState = 'pending' | 'included' | 'confirmed' | 'failed' | 'not-found'
export interface TxStatus { state: TxState; blockNumber: number | null; feeSun: bigint | null; message: string | null; checkedAt: number }

interface InfoRead { found: boolean; failed: boolean; blockNumber: number | null; feeSun: bigint | null; message: string | null }

function readInfo(body: Record<string, unknown>): InfoRead {
  const blockNumber = typeof body.blockNumber === 'number' ? body.blockNumber : null
  if (blockNumber === null) return { found: false, failed: false, blockNumber: null, feeSun: null, message: null }
  const receipt = typeof body.receipt === 'object' && body.receipt !== null ? (body.receipt as Record<string, unknown>) : {}
  const receiptResult = typeof receipt.result === 'string' ? receipt.result : null
  const failed = body.result === 'FAILED' || (receiptResult !== null && receiptResult !== 'SUCCESS')
  const feeSun = typeof body.fee === 'number' && Number.isSafeInteger(body.fee) && body.fee >= 0 ? BigInt(body.fee) : null
  return { found: true, failed, blockNumber, feeSun, message: failed ? decodeNodeMessage(body.resMessage) || receiptResult || 'The transaction failed on chain.' : null }
}

/**
 * Real Shasta status. "confirmed" requires the SOLIDITY node (irreversible data) to have the transaction; a transaction the
 * full node has in a block but the solidity node does not yet is only "included". A transaction nobody knows about is
 * "pending" until its expiry passes, then "not-found" (it was most likely never accepted).
 */
export async function fetchShastaTxStatus(txId: string, expirationMs: number, options: RpcOptions & { now?: () => number } = {}): Promise<TxStatus> {
  if (!isTxId(txId)) throw new TransferError('invalid-input', 'Not a valid transaction ID.')
  const now = options.now ?? Date.now
  const solidity = readInfo(await postShasta('/walletsolidity/gettransactioninfobyid', { value: txId }, options))
  if (solidity.found) return { state: solidity.failed ? 'failed' : 'confirmed', blockNumber: solidity.blockNumber, feeSun: solidity.feeSun, message: solidity.message, checkedAt: now() }
  const full = readInfo(await postShasta('/wallet/gettransactioninfobyid', { value: txId }, options))
  if (full.found) return { state: full.failed ? 'failed' : 'included', blockNumber: full.blockNumber, feeSun: full.feeSun, message: full.message, checkedAt: now() }
  const expired = now() > expirationMs + 30_000
  return { state: expired ? 'not-found' : 'pending', blockNumber: null, feeSun: null, message: expired ? 'Shasta has no record of this transaction after its expiry, so it was most likely not accepted.' : null, checkedAt: now() }
}
