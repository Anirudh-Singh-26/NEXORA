/**
 * Pure derivation of a wallet-relative summary from a Solana `getTransaction` response (encoding "jsonParsed",
 * maxSupportedTransactionVersion 0). Shared by the server proxy and its tests. No I/O, no React.
 *
 * What is claimed and what is not:
 *  - A transaction made ONLY of System Program transfers (compute-budget instructions are ignored) yields an exact amount,
 *    direction and counterparty, but only when it succeeded: a failed transaction moved nothing except its fee.
 *  - Anything else (swaps, token programs, program calls, mixed transfers) yields NO amount claim. Only the wallet's own
 *    balance change (post − pre) is reported, which is a fact of the ledger and includes any fee the wallet paid.
 *  - Anything malformed returns null ("details unavailable") instead of a guess.
 */
import type { SolanaTxDetails } from './types.ts'

const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value)
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value)

function keyOf(entry: unknown): string | null {
  if (typeof entry === 'string') return entry
  if (isObj(entry) && typeof entry.pubkey === 'string') return entry.pubkey
  return null
}

interface Transfer { source: string; destination: string; lamports: bigint }

/** A System Program transfer from a jsonParsed instruction, or null when the instruction is anything else. */
function systemTransfer(ix: unknown): Transfer | null {
  if (!isObj(ix) || ix.program !== 'system' || !isObj(ix.parsed)) return null
  const type = ix.parsed.type
  if (type !== 'transfer' && type !== 'transferWithSeed') return null
  const info = ix.parsed.info
  if (!isObj(info) || typeof info.source !== 'string' || typeof info.destination !== 'string' || !isInt(info.lamports) || info.lamports < 0) return null
  return { source: info.source, destination: info.destination, lamports: BigInt(info.lamports) }
}

export function parseTransactionDetails(tx: unknown, wallet: string): SolanaTxDetails | null {
  if (!isObj(tx) || !isObj(tx.meta) || !isObj(tx.transaction) || !isObj(tx.transaction.message)) return null
  const meta = tx.meta
  const message = tx.transaction.message
  if (!Array.isArray(message.accountKeys) || !Array.isArray(message.instructions)) return null

  const staticKeys = message.accountKeys.map(keyOf)
  if (staticKeys.some((key) => key === null)) return null
  const keys = [...(staticKeys as string[])]
  // Version-0 transactions can load more accounts from lookup tables; balances arrays cover static + writable + readonly.
  if (isObj(meta.loadedAddresses)) {
    for (const group of [meta.loadedAddresses.writable, meta.loadedAddresses.readonly]) {
      if (Array.isArray(group)) for (const key of group) if (typeof key === 'string') keys.push(key)
    }
  }

  const pre = meta.preBalances
  const post = meta.postBalances
  let netChangeLamports: string | null = null
  const index = keys.indexOf(wallet)
  if (index >= 0 && Array.isArray(pre) && Array.isArray(post) && isInt(pre[index]) && isInt(post[index])) {
    netChangeLamports = (BigInt(post[index]) - BigInt(pre[index])).toString()
  }
  const feeLamports = keys[0] === wallet && isInt(meta.fee) && meta.fee >= 0 ? String(meta.fee) : null
  const failed = meta.err !== null && meta.err !== undefined
  if (meta.err === undefined) return null // the success/failure field is missing: do not guess

  const transfers: Transfer[] = []
  let plain = message.instructions.length > 0
  for (const ix of message.instructions) {
    const transfer = systemTransfer(ix)
    if (transfer) { transfers.push(transfer); continue }
    if (isObj(ix) && ix.programId === COMPUTE_BUDGET_PROGRAM) continue
    plain = false
  }
  // A plain transfer never has inner (CPI) instructions; if any are reported, it is not plain.
  if (Array.isArray(meta.innerInstructions) && meta.innerInstructions.length > 0) plain = false
  plain = plain && transfers.length > 0

  const other: SolanaTxDetails = { kind: 'other', direction: 'other', counterparty: null, lamports: null, netChangeLamports, feeLamports }
  if (!plain) return other

  const sent = transfers.filter((t) => t.source === wallet)
  const received = transfers.filter((t) => t.destination === wallet)
  if (sent.length === 0 && received.length === 0) return { ...other, kind: 'transfer' }

  const sentTotal = sent.reduce((sum, t) => sum + t.lamports, 0n)
  const receivedTotal = received.reduce((sum, t) => sum + t.lamports, 0n)
  const involved = transfers.filter((t) => t.source === wallet || t.destination === wallet)
  const parties = new Set(involved.flatMap((t) => [t.source, t.destination]).filter((address) => address !== wallet))
  const counterparty = parties.size === 1 ? [...parties][0] : null

  let direction: SolanaTxDetails['direction']
  if (sent.length > 0 && received.length === 0) direction = 'sent'
  else if (received.length > 0 && sent.length === 0) direction = 'received'
  else if (sentTotal === receivedTotal && involved.every((t) => t.source === wallet && t.destination === wallet)) direction = 'self'
  else return other // mixed in/out: no single amount is honest, report the balance change only

  // A failed transaction moved no SOL (only the fee was charged), so no amount is claimed for it.
  const lamports = failed ? null : (direction === 'sent' ? sentTotal : direction === 'received' ? receivedTotal : sentTotal).toString()
  return { kind: 'transfer', direction, counterparty, lamports, netChangeLamports, feeLamports }
}
