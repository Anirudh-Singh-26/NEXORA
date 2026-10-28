/**
 * @ton/core binding for confirmation.ts: decodes the signed external message returned by TON Connect and the
 * transaction BOCs returned by toncenter v2 `getTransactions` (`data` field).
 *
 * Message identity follows the official TON Connect message-lookup guide / TEP-467: an external-in message is
 * hashed after normalization (src = addr_none, import_fee = 0, no init, body always stored as a reference), so the
 * same request hashes identically however the wallet or node serialized it.
 */
import { beginCell, Cell, loadMessage, loadTransaction, storeMessage, type Message } from '@ton/core'
import type { ParsedMessage, ParsedTx, TonCodec, TrackedMessage } from './confirmation.ts'

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** TEP-467 normalized hash (lowercase hex) of an external-in message. Throws for any other message type. */
export function getNormalizedExtMessageHash(message: Message): string {
  if (message.info.type !== 'external-in') throw new Error(`Message must be "external-in", got ${message.info.type}`)
  const info = { ...message.info, src: undefined, importFee: 0n }
  const normalized: Message = { ...message, init: null, info }
  return toHex(beginCell().store(storeMessage(normalized, { forceRef: true })).endCell().hash())
}

/**
 * Derive the tracking identity from the BOC returned by TON Connect `sendTransaction`.
 * Returns null when it is not a parseable external-in message; the caller must then report the transfer as
 * untracked instead of guessing.
 */
export function extractTrackedMessage(boc: string): TrackedMessage | null {
  try {
    const message = loadMessage(Cell.fromBase64(boc).beginParse())
    if (message.info.type !== 'external-in') return null
    return { hash: getNormalizedExtMessageHash(message), account: message.info.dest.toRawString() }
  } catch {
    return null
  }
}

function describeMessage(message: Message | null | undefined): ParsedMessage | null {
  if (!message) return null
  const info = message.info
  if (info.type === 'external-in') {
    try {
      return { kind: 'external-in', normalizedHash: getNormalizedExtMessageHash(message), dest: info.dest.toRawString() }
    } catch {
      return { kind: 'other' }
    }
  }
  if (info.type === 'internal') {
    return { kind: 'internal', src: info.src.toRawString(), dest: info.dest.toRawString(), createdLt: info.createdLt.toString() }
  }
  return { kind: 'other' }
}

export const tonCodec: TonCodec = {
  parseTransaction(data: unknown): ParsedTx | null {
    if (typeof data !== 'string' || data === '') return null
    try {
      const tx = loadTransaction(Cell.fromBase64(data).beginParse())
      const d = tx.description
      let phases: ParsedTx['phases'] = null
      if (d.type === 'generic') {
        phases = {
          aborted: d.aborted,
          compute: d.computePhase.type === 'skipped' ? 'skipped' : d.computePhase.success ? 'success' : 'failed',
          action: d.actionPhase ? (d.actionPhase.success ? 'success' : 'failed') : 'none',
          bounced: d.bouncePhase !== undefined && d.bouncePhase !== null,
        }
      }
      return {
        lt: tx.lt.toString(),
        hash: toHex(tx.hash()),
        inMessage: describeMessage(tx.inMessage),
        outMessages: tx.outMessages.values().map((m) => describeMessage(m)).filter((m): m is ParsedMessage => m !== null),
        phases,
      }
    } catch {
      return null
    }
  },
}
