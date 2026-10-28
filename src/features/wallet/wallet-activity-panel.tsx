import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Circle, CircleAlert, ExternalLink, LoaderCircle, Repeat2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { WalletActivity } from '@/hooks/use-wallet-activity'
import { ACTIVITY_CHAINS } from '@/lib/wallet-activity/chains'
import { buildEvmRow, buildSolanaRow, type EvmRowView, type SolanaRowView } from '@/lib/wallet-activity/presentation'
import { shortHash } from '@/lib/wallet-activity/wallet-activity'
import { RefreshButton, RowSkeletons, SectionHead, SourcePill, StateBlock } from '@/features/wallet/wallet-ui'
import { agoLabel, dailyCounts, RHYTHM_DAYS } from '@/features/wallet/wallet-activity-helpers'

const INITIAL_VISIBLE_ROWS = 7

function Rhythm({ timestamps, hasMore }: { timestamps: Array<string | null>; hasMore: boolean }) {
  const buckets = useMemo(() => dailyCounts(timestamps), [timestamps])
  const max = Math.max(...buckets.map((bucket) => bucket.count), 0)
  if (max === 0) return null
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  return (
    <div className="wlt-rhythm" role="img" aria-label={`${total} of the loaded transactions fall in the last ${RHYTHM_DAYS} days`}>
      <div className="wlt-rhythm__bars" aria-hidden="true">
        {buckets.map((bucket) => {
          const dateStr = new Date(bucket.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          return (
            <span
              key={bucket.start}
              className={bucket.count > 0 ? 'is-on' : ''}
              style={{ height: `${bucket.count === 0 ? 4 : 10 + (bucket.count / max) * 90}%` }}
              title={`${dateStr}: ${bucket.count} transaction${bucket.count === 1 ? '' : 's'}`}
            />
          )
        })}
      </div>
      <p>Last {RHYTHM_DAYS} days · {total} of {hasMore ? 'loaded ' : ''}transactions</p>
    </div>
  )
}

function directionIcon(direction: EvmRowView['direction']) {
  if (direction === 'received') return <ArrowDownLeft size={14} />
  if (direction === 'sent') return <ArrowUpRight size={14} />
  if (direction === 'self') return <Repeat2 size={14} />
  return <Circle size={10} />
}

function EvmItem({ row }: { row: EvmRowView }) {
  const more = row.transfers.length - 1
  const body = (
    <>
      <strong>{row.headline}</strong>
      <span>{row.typeLabel}{more > 0 ? ` · +${more} more transfer${more === 1 ? '' : 's'}` : ''} · <time dateTime={row.timestamp ?? undefined}>{agoLabel(row.timestamp)}</time></span>
    </>
  )
  return (
    <li className={`wlt-event is-${row.direction}`}>
      <span className="wlt-event__node" aria-hidden="true">{directionIcon(row.direction)}</span>
      {row.url
        ? <a href={row.url} target="_blank" rel="noreferrer noopener" className="wlt-event__body">{body}<ExternalLink size={12} aria-hidden="true" /><span className="wlt-sr"> (opens block explorer)</span></a>
        : <div className="wlt-event__body">{body}</div>}
    </li>
  )
}

function SolanaItem({ row }: { row: SolanaRowView }) {
  const failed = row.status === 'failed'
  const pending = row.confirmation === 'processed'
  const body = (
    <>
      <strong>{row.headline}{row.amountText ? <> <span className="wlt-sr">(</span><span aria-hidden="true">· </span>{row.amountText}<span className="wlt-sr">)</span></> : null}</strong>
      <span>
        {row.statusLabel}
        {row.counterparty ? <> · {row.direction === 'received' ? 'from' : 'to'} <code title={row.counterparty.full}>{row.counterparty.short}</code></> : null}
        {' · '}<code>{shortHash(row.signature)}</code> · <time dateTime={row.timestamp ?? undefined}>{agoLabel(row.timestamp)}</time>
        {row.feeText ? ` · fee ${row.feeText}` : ''}
        {row.netChangeText ? ` · net ${row.netChangeText} (includes fees)` : ''}
        {row.detailsUnavailable ? ' · details unavailable, open the explorer' : ''}
        {failed ? ' · no SOL was transferred' : ''}
      </span>
    </>
  )
  return (
    <li className={`wlt-event ${failed ? 'is-failed' : row.direction === 'sent' || row.direction === 'received' || row.direction === 'self' ? `is-${row.direction}` : 'is-other'}`}>
      <span className="wlt-event__node" aria-hidden="true">{failed ? <CircleAlert size={14} /> : pending ? <LoaderCircle size={14} /> : directionIcon(row.direction === 'unknown' ? 'other' : row.direction)}</span>
      {row.url
        ? <a href={row.url} target="_blank" rel="noreferrer noopener" className="wlt-event__body">{body}<ExternalLink size={12} aria-hidden="true" /><span className="wlt-sr"> (opens Solana Devnet explorer)</span></a>
        : <div className="wlt-event__body">{body}</div>}
    </li>
  )
}

export type EvmFilterType = 'all' | 'received' | 'sent'
export type SolanaFilterType = 'all' | 'received' | 'sent' | 'failed'

/**
 * Compact yet complete activity timeline for the Wallets page. Uses the project's existing read-only activity hook;
 * filterable by transfer direction, expandable inline with load-more support, or linkable to the full Activity page.
 */
export function WalletActivityPanel({ activity }: { activity: WalletActivity }) {
  const { target } = activity
  const ready = target.kind === 'ready'
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const [filter, setFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState(false)

  const rawEvmRows = useMemo(() => (
    activity.ecosystem === 'evm' && target.kind === 'ready' && target.ecosystem === 'evm'
      ? activity.items.map((item) => buildEvmRow(item, target.address, target.chainId, now))
      : []
  ), [activity, target, now])

  const rawSolRows = useMemo(() => (
    activity.ecosystem === 'solana' ? activity.items.map((item) => buildSolanaRow(item, now)) : []
  ), [activity, now])

  const filteredEvmRows = useMemo(() => {
    if (filter === 'all') return rawEvmRows
    return rawEvmRows.filter((r) => r.direction === filter)
  }, [rawEvmRows, filter])

  const filteredSolRows = useMemo(() => {
    if (filter === 'all') return rawSolRows
    if (filter === 'failed') return rawSolRows.filter((r) => r.status === 'failed')
    return rawSolRows.filter((r) => r.status !== 'failed' && r.direction === filter)
  }, [rawSolRows, filter])

  const evmRows = expanded ? filteredEvmRows : filteredEvmRows.slice(0, INITIAL_VISIBLE_ROWS)
  const solRows = expanded ? filteredSolRows : filteredSolRows.slice(0, INITIAL_VISIBLE_ROWS)
  const visibleCount = activity.ecosystem === 'evm' ? evmRows.length : solRows.length
  const totalFilteredCount = activity.ecosystem === 'evm' ? filteredEvmRows.length : filteredSolRows.length

  const timestamps = useMemo(() => (
    activity.ecosystem === 'evm' ? activity.items.map((item) => item.timestamp)
      : activity.ecosystem === 'solana' ? activity.items.map((item) => (item.blockTime === null ? null : new Date(item.blockTime * 1000).toISOString()))
      : []
  ), [activity])

  const loadedCount = activity.items.length
  const status = !ready ? 'idle' : activity.error && !activity.loaded ? 'unavailable' : activity.loaded ? (activity.error ? 'stale' : loadedCount === 0 ? 'empty' : 'live') : 'loading'
  const networkName = target.kind === 'ready' && target.ecosystem === 'evm' ? ACTIVITY_CHAINS[target.chainId].name : target.kind === 'ready' ? 'Solana Devnet' : null

  return (
    <section className="wlt-section wlt-section--rail" id="wlt-activity" aria-label="Recent activity" tabIndex={-1}>
      <SectionHead
        label={networkName ?? undefined}
        title="Recent activity"
        aside={<div className="wlt-head-tools">{ready && <SourcePill status={status} label={activity.loaded && !activity.error && loadedCount > 0 ? `${loadedCount}${activity.hasMore ? '+' : ''} loaded` : undefined} />}{ready && <RefreshButton onClick={activity.refresh} busy={activity.loading} label="Refresh activity" />}</div>}
      />
      <div aria-live="polite">
        {target.kind === 'invalid-address' && <StateBlock tone="error" icon={<CircleAlert size={18} />} title="Address unreadable">Activity cannot be requested for this address. Reconnect and try again.</StateBlock>}
        {target.kind === 'unknown-network' && <StateBlock tone="info" icon={<CircleAlert size={18} />} title="Network unknown">The active network could not be read from your wallet, so no activity was requested.</StateBlock>}
        {target.kind === 'unsupported-network' && <StateBlock tone="info" icon={<CircleAlert size={18} />} title="Activity unavailable on this network">{target.reason}</StateBlock>}

        {ready && activity.loading && !activity.loaded && <RowSkeletons count={4} label="Loading activity" />}

        {ready && activity.error && (
          <StateBlock
            tone="error" icon={<CircleAlert size={18} />} title={activity.loaded ? 'Refresh failed' : 'Activity could not be loaded'}
            action={activity.error.retryable ? <button type="button" className="wlt-btn wlt-btn--sm" onClick={activity.refresh}>Retry</button> : undefined}
          >
            {activity.error.message}{activity.loaded ? ' Showing the last loaded transactions.' : ' This means the history could not be read, not that the wallet has none.'}
          </StateBlock>
        )}

        {ready && activity.loaded && loadedCount === 0 && !activity.error && (
          <StateBlock icon={<Circle size={16} />} title="No activity found">The provider returned no {activity.ecosystem === 'evm' ? 'native, token or NFT transfers' : 'transactions'} for this address on {networkName}.{activity.ecosystem === 'solana' ? ' Receive some Devnet SOL from a faucet, or send a transfer, and it will appear here.' : ' Activity on other networks appears when you switch networks in your wallet.'}</StateBlock>
        )}

        {ready && loadedCount > 0 && (
          <>
            <Rhythm timestamps={timestamps} hasMore={activity.hasMore} />

            {/* Quick direction filter tabs */}
            {activity.ecosystem === 'evm' ? (
              <div className="wlt-filters" role="group" aria-label="Filter activity by direction">
                <button type="button" className={`wlt-filter-btn ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>All ({rawEvmRows.length})</button>
                <button type="button" className={`wlt-filter-btn ${filter === 'received' ? 'is-active' : ''}`} onClick={() => setFilter('received')}>Received</button>
                <button type="button" className={`wlt-filter-btn ${filter === 'sent' ? 'is-active' : ''}`} onClick={() => setFilter('sent')}>Sent</button>
              </div>
            ) : (
              <div className="wlt-filters" role="group" aria-label="Filter activity by direction or status">
                <button type="button" className={`wlt-filter-btn ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>All ({rawSolRows.length})</button>
                <button type="button" className={`wlt-filter-btn ${filter === 'received' ? 'is-active' : ''}`} onClick={() => setFilter('received')}>Received</button>
                <button type="button" className={`wlt-filter-btn ${filter === 'sent' ? 'is-active' : ''}`} onClick={() => setFilter('sent')}>Sent</button>
                <button type="button" className={`wlt-filter-btn ${filter === 'failed' ? 'is-active' : ''}`} onClick={() => setFilter('failed')}>Failed</button>
              </div>
            )}

            {visibleCount > 0 ? (
              <ol className="wlt-timeline" aria-label="Recent transactions">
                {activity.ecosystem === 'evm' ? evmRows.map((row) => <EvmItem key={row.id} row={row} />) : solRows.map((row) => <SolanaItem key={row.id} row={row} />)}
              </ol>
            ) : (
              <p className="wlt-note">No transactions match the selected filter.</p>
            )}

            {/* Expansion and Pagination */}
            <div className="wlt-activity-actions">
              {totalFilteredCount > INITIAL_VISIBLE_ROWS && (
                <button type="button" className="wlt-btn wlt-btn--sm" onClick={() => setExpanded(!expanded)}>
                  {expanded ? 'Show fewer' : `Show all ${totalFilteredCount} loaded`}
                </button>
              )}

              {activity.hasMore && (
                <button
                  type="button"
                  className="wlt-btn wlt-btn--sm"
                  onClick={activity.loadMore}
                  disabled={activity.loadingMore || activity.loading}
                >
                  {activity.loadingMore ? <><LoaderCircle size={13} className="wlt-spin" aria-hidden="true" />Loading…</> : 'Load more history'}
                </button>
              )}
            </div>

            {activity.moreError && (
              <p className="wlt-warn"><CircleAlert size={14} aria-hidden="true" /><span>Could not load older activity: {activity.moreError.message}</span></p>
            )}

            <Link to="/activity" className="wlt-link wlt-link--block">Open full activity workspace<ArrowUpRight size={12} aria-hidden="true" /></Link>
          </>
        )}
      </div>
    </section>
  )
}
