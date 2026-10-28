import { motion } from 'motion/react'
import { ArrowUpRight, ShieldCheck, TriangleAlert } from 'lucide-react'
import { dur, ease } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { ACTIVITY_CHAINS, evmAddressUrl } from '@/lib/wallet-activity/chains'
import { shortAddress, shortHash } from '@/lib/wallet-activity/wallet-activity'
import type { EvmRowView, SolanaRowView, TransferView } from '@/lib/wallet-activity/presentation'
import { EVM_KIND_ICON } from './event-kind-icon'

function whenLabel(timestamp: string | null, group: EvmRowView['group']) {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return group === 'Today' ? time : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} ${time}`
}

function Stamp({ timestamp, group }: { timestamp: string | null; group: EvmRowView['group'] }) {
  return timestamp
    ? <time className="nxa-event__time" dateTime={timestamp} title={new Date(timestamp).toLocaleString()}>{whenLabel(timestamp, group)}</time>
    : <span className="nxa-event__time" title="The provider did not return a timestamp for this transaction">—</span>
}

function NetworkLabel({ name }: { name: string }) {
  return <span className="nx-network-chip inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas/50 px-2 py-0.5 text-[11px] uppercase tracking-wider text-mute"><span className="size-1.5 rounded-full bg-copper" />{name}</span>
}

function TransferChip({ transfer, chainId }: { transfer: TransferView; chainId: number }) {
  const href = transfer.counterparty ? evmAddressUrl(chainId, transfer.counterparty.address) : null
  return (
    <span className="nxa-fact">
      <span>{transfer.direction === 'sent' ? 'Sent' : transfer.direction === 'received' ? 'Received' : transfer.direction === 'self' ? 'Self' : 'Transfer'}</span>
      <b>{transfer.noNativeValue ? 'no native value' : transfer.text}</b>
      {transfer.counterparty ? (
        <span className="font-mono normal-case tracking-normal">
          {transfer.counterparty.label.toLowerCase()}{' '}
          {href ? <a href={href} target="_blank" rel="noreferrer noopener" className="hover:underline">{shortAddress(transfer.counterparty.address)}</a> : shortAddress(transfer.counterparty.address)}
        </span>
      ) : null}
    </span>
  )
}

/** One EVM transaction: timestamp, spine node, headline linking to the block explorer, every transfer it contained. */
export function EvmEventRow({ row, chainId, index }: { row: EvmRowView; chainId: number; index: number }) {
  const chain = ACTIVITY_CHAINS[chainId]
  return (
    <motion.li initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.base, ease, delay: Math.min(index, 10) * 0.025 }} className={cn('nxa-event', `is-${row.kind}`)}>
      <Stamp timestamp={row.timestamp} group={row.group} />
      <span className="nxa-event__node" aria-hidden>{EVM_KIND_ICON[row.kind]}</span>
      <div className="nxa-event__body">
        <p className="nxa-event__type">{row.typeLabel}</p>
        {row.url
          ? <a href={row.url} target="_blank" rel="noreferrer noopener" className="nxa-event__title">{row.headline}<ArrowUpRight className="size-3.5" aria-hidden /><span className="sr-only"> (opens block explorer)</span></a>
          : <span className="nxa-event__title">{row.headline}</span>}
        <div className="nxa-event__meta">
          {chain ? <NetworkLabel name={chain.name} /> : null}
          {row.transfers.map((transfer, i) => <TransferChip key={i} transfer={transfer} chainId={chainId} />)}
          <span className="nxa-fact"><span>Tx</span><b>{shortHash(row.hash)}</b></span>
          <span className="nxa-fact"><span>Block</span><b>{row.blockNumber.toLocaleString()}</b></span>
        </div>
      </div>
    </motion.li>
  )
}

/** One Solana Devnet transaction: direction, amount, counterparty, fee and status when readable; otherwise signature-level data only. */
export function SolanaEventRow({ row, index }: { row: SolanaRowView; index: number }) {
  const failed = row.status === 'failed'
  return (
    <motion.li initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.base, ease, delay: Math.min(index, 10) * 0.025 }} className={cn('nxa-event', failed ? 'is-failed' : 'is-sol')}>
      <Stamp timestamp={row.timestamp} group={row.group} />
      <span className="nxa-event__node" aria-hidden>{failed ? <TriangleAlert size={14} /> : <ShieldCheck size={14} />}</span>
      <div className="nxa-event__body">
        <p className="nxa-event__type">
          {row.headline}
          <span className={cn('nxa-status', failed ? 'is-failed' : row.status ? 'is-success' : '')}>{row.statusLabel}</span>
        </p>
        {row.url
          ? <a href={row.url} target="_blank" rel="noreferrer noopener" className="nxa-event__title font-mono">{shortHash(row.signature)}<ArrowUpRight className="size-3.5" aria-hidden /><span className="sr-only"> (opens Solana Devnet explorer)</span></a>
          : <span className="nxa-event__title font-mono">{shortHash(row.signature)}</span>}
        <div className="nxa-event__meta">
          <NetworkLabel name="Solana Devnet" />
          {row.amountText ? <span className="nxa-fact"><span>Amount</span><b>{row.amountText}</b></span> : null}
          {row.counterparty ? <span className="nxa-fact"><span>{row.direction === 'received' ? 'From' : 'To'}</span><b title={row.counterparty.full}>{row.counterparty.short}</b></span> : null}
          {row.feeText ? <span className="nxa-fact"><span>Fee</span><b>{row.feeText}</b></span> : null}
          {row.netChangeText ? <span className="nxa-fact"><span>Net change</span><b>{row.netChangeText}</b></span> : null}
          <span className="nxa-fact"><span>Slot</span><b>{row.slot.toLocaleString()}</b></span>
          {failed ? <span className="nxa-fact is-muted">No SOL was transferred</span> : null}
          {row.detailsUnavailable ? <span className="nxa-fact is-muted">Details unavailable: see explorer</span> : null}
        </div>
      </div>
    </motion.li>
  )
}
