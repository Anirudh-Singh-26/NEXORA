/**
 * Pure view-model helpers for the Activity page: turns validated provider entries into display rows. Every string
 * shown is derived from returned data; nothing is inferred beyond what the provider supplied (no swap/bridge/mint
 * guessing, no status for EVM transactions because receipts are not fetched).
 */
import { groupDecimal } from '../blockchain/wallet-balance.ts'
import { lamportsToSol } from '../solana-balance/solana-balance.ts'
import { ACTIVITY_CHAINS, evmAddressUrl, evmTxUrl, solanaTxUrl } from './chains.ts'
import type { EvmTransfer } from './types.ts'
import { directionFor, shortAddress, solanaTimestamp, timeGroup, type Direction, type EvmEntry, type EvmKind, type SolanaEntry, type TimeGroup } from './wallet-activity.ts'

const MAX_FRACTION = 6

/** Groups digits and truncates (never rounds up) to 6 fraction digits; tiny non-zero amounts show as "<0.000001". */
export function formatActivityAmount(amount: string | null): string | null {
  if (amount === null || !/^[0-9]+(\.[0-9]+)?$/.test(amount)) return null
  const [whole, fraction = ''] = amount.split('.')
  const kept = fraction.slice(0, MAX_FRACTION).replace(/0+$/, '')
  if (whole.replace(/^0+/, '') === '' && kept === '' && /[1-9]/.test(fraction)) return `<0.${'0'.repeat(MAX_FRACTION - 1)}1`
  return groupDecimal(kept ? `${whole}.${kept}` : whole)
}

export interface TransferView {
  direction: Direction
  kind: EvmKind
  /** e.g. "1.5 ETH", "12.5 USDC", "NFT #42", "2 × NFT #7". */
  text: string
  /** The other party of the transfer, relative to the wallet. */
  counterparty: { label: 'To' | 'From'; address: string } | null
  /** True for a zero-value native transaction (typically a contract call, but the provider does not say so). */
  noNativeValue: boolean
}

export function describeTransfer(t: EvmTransfer, wallet: string, nativeSymbol: string): TransferView {
  const me = wallet.toLowerCase()
  const direction: Direction = t.from === me && t.to === me ? 'self' : t.from === me ? 'sent' : t.to === me ? 'received' : 'other'
  const counterparty = direction === 'sent' && t.to ? { label: 'To' as const, address: t.to } : direction === 'received' && t.from ? { label: 'From' as const, address: t.from } : null
  if (t.category === 'external') {
    const amount = formatActivityAmount(t.amount)
    const zero = t.amount !== null && !/[1-9]/.test(t.amount)
    return { direction, kind: 'native', counterparty, noNativeValue: zero, text: amount === null ? `${t.asset ?? nativeSymbol} (amount not provided)` : `${amount} ${t.asset ?? nativeSymbol}` }
  }
  if (t.category === 'erc20') {
    const amount = formatActivityAmount(t.amount)
    const symbol = t.asset ?? (t.contract ? shortAddress(t.contract) : 'token')
    return { direction, kind: 'token', counterparty, noNativeValue: false, text: amount === null ? `${symbol} (amount not provided)` : `${amount} ${symbol}` }
  }
  const id = t.tokenId !== null ? `NFT #${t.tokenId.length > 12 ? `${t.tokenId.slice(0, 6)}…${t.tokenId.slice(-4)}` : t.tokenId}` : 'NFT'
  const quantity = t.category === 'erc1155' && t.amount !== null && t.amount !== '1' ? `${t.amount} × ` : ''
  return { direction, kind: 'nft', counterparty, noNativeValue: false, text: `${quantity}${id}` }
}

const VERB: Record<Direction, string> = { sent: 'Sent', received: 'Received', self: 'Self-transfer', other: 'Transfer' }

export interface EvmRowView {
  id: string
  hash: string
  blockNumber: number
  /** Verified explorer link, or null. */
  url: string | null
  timestamp: string | null
  group: TimeGroup
  direction: Direction
  /** Kind of the primary transfer: drives the row colour. */
  kind: EvmKind
  typeLabel: string
  headline: string
  /** Every transfer in the transaction, primary first. */
  transfers: TransferView[]
}

export function buildEvmRow(item: EvmEntry, wallet: string, chainId: number, now: Date = new Date()): EvmRowView {
  const nativeSymbol = ACTIVITY_CHAINS[chainId]?.nativeSymbol ?? 'native token'
  const transfers = item.transfers.map((t) => describeTransfer(t, wallet, nativeSymbol))
  const primary = transfers[0]
  const direction = directionFor(item, wallet)
  const what = primary.noNativeValue ? 'transaction (no native value)' : primary.text
  const headline = direction === 'self' ? `Self-transfer of ${what}` : `${VERB[direction]} ${what}`
  const typeLabel = primary.kind === 'native' ? (primary.noNativeValue ? 'Transaction' : 'Native transfer') : primary.kind === 'token' ? 'Token transfer' : 'NFT transfer'
  return { id: item.id, hash: item.hash, blockNumber: item.blockNumber, url: evmTxUrl(chainId, item.hash), timestamp: item.timestamp, group: timeGroup(item.timestamp, now), direction, kind: primary.kind, typeLabel, headline, transfers }
}

export interface SolanaRowView {
  id: string
  signature: string
  url: string | null
  timestamp: string | null
  group: TimeGroup
  status: 'success' | 'failed' | null
  slot: number
  confirmation: SolanaEntry['confirmation']
  /** Relative to the wallet; 'unknown' when the details could not be read. */
  direction: 'sent' | 'received' | 'self' | 'other' | 'unknown'
  headline: string
  /** Signed SOL amount with symbol (e.g. "+0.5 SOL"), only for a successful plain transfer. */
  amountText: string | null
  /** The wallet's own balance change (e.g. "-0.000005 SOL"), reported when no exact amount can be claimed. */
  netChangeText: string | null
  feeText: string | null
  /** The other party of a plain transfer, shortened for display, with the full address for a link/title. */
  counterparty: { short: string; full: string } | null
  /** Plain-language status for the badge: Failed / Processing / Confirmed / Finalized / Status unknown. */
  statusLabel: string
  /** True when direction/amount could not be derived and the row shows signature-level data only. */
  detailsUnavailable: boolean
}

const CONFIRMATION_LABEL = { processed: 'Processing', confirmed: 'Confirmed', finalized: 'Finalized' } as const

function signedSol(lamports: string, sign: '+' | '-' | ''): string {
  return `${sign}${lamportsToSol(BigInt(lamports))} SOL`
}

export function buildSolanaRow(item: SolanaEntry, now: Date = new Date()): SolanaRowView {
  const timestamp = solanaTimestamp(item)
  const d = item.details
  const failed = item.status === 'failed'
  const statusLabel = failed ? 'Failed' : item.confirmation ? CONFIRMATION_LABEL[item.confirmation] : item.status === 'success' ? 'Succeeded' : 'Status unknown'

  let headline = 'Transaction'
  let amountText: string | null = null
  if (d && d.lamports !== null && !failed) {
    if (d.direction === 'sent') { headline = `Sent ${lamportsToSol(BigInt(d.lamports))} SOL`; amountText = signedSol(d.lamports, '-') }
    else if (d.direction === 'received') { headline = `Received ${lamportsToSol(BigInt(d.lamports))} SOL`; amountText = signedSol(d.lamports, '+') }
    else if (d.direction === 'self') { headline = `Self-transfer of ${lamportsToSol(BigInt(d.lamports))} SOL`; amountText = signedSol(d.lamports, '') }
  } else if (failed) {
    headline = 'Failed transaction'
  } else if (d?.kind === 'other') {
    headline = 'Program interaction'
  } else if (d) {
    headline = 'Transaction (no SOL sent or received by this wallet)'
  }

  let netChangeText: string | null = null
  if (d && amountText === null && d.netChangeLamports !== null) {
    const net = BigInt(d.netChangeLamports)
    netChangeText = net === 0n ? '0 SOL' : signedSol((net < 0n ? -net : net).toString(), net < 0n ? '-' : '+')
  }
  return {
    id: item.id, signature: item.signature, url: solanaTxUrl(item.signature), timestamp, group: timeGroup(timestamp, now), status: item.status, slot: item.slot, confirmation: item.confirmation,
    direction: d ? d.direction : 'unknown', headline, amountText, netChangeText,
    feeText: d?.feeLamports ? `${lamportsToSol(BigInt(d.feeLamports))} SOL` : null,
    counterparty: d?.counterparty ? { short: shortAddress(d.counterparty), full: d.counterparty } : null,
    statusLabel, detailsUnavailable: d === null,
  }
}

export { evmAddressUrl }
