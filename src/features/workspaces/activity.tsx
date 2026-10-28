import { useEffect, useMemo, useState } from 'react'
import { CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Segmented } from '@/components/shared/segmented'
import { useWalletActivity } from '@/hooks/use-wallet-activity'
import { useWallet } from '@/features/wallet-provider'
import { cn } from '@/lib/utils'
import { ACTIVITY_CHAINS } from '@/lib/wallet-activity/chains'
import { buildEvmRow, buildSolanaRow, type EvmRowView, type SolanaRowView } from '@/lib/wallet-activity/presentation'
import { EVM_KIND_LABEL, EVM_KINDS, filterEvm, filterSolana, kindsFor, solanaTimestamp, timeGroup, type EvmKind, type TimeGroup } from '@/lib/wallet-activity/wallet-activity'
import { SearchField } from '@/features/workspaces/shared/search-field'
import { EvmEventRow, SolanaEventRow } from '@/features/workspaces/activity/components/event-row'
import { EVM_KIND_ICON } from '@/features/workspaces/activity/components/event-kind-icon'
import './activity/activity-page.css'

type TimeFilter = 'all' | 'Today' | 'Earlier'
const GROUPS: TimeGroup[] = ['Today', 'Earlier', 'Date unavailable']

/**
 * Activity: the connected wallet's real on-chain history.
 *  - EVM: Alchemy Transfers API via /api/wallet-activity (sent + received native, ERC-20, ERC-721, ERC-1155 transfers,
 *    grouped per transaction) on the network the wallet is connected to.
 *  - Solana: Devnet transactions via /api/solana-activity (signatures + parsed transaction details), with direction, amount
 *    when reliably derivable, fee, status and time. Mainnet is never read.
 * Nothing is simulated; with no wallet connected there is nothing to show. Read-only. Owns its page heading.
 */
export function ActivityWorkspace() {
  const wallet = useWallet()
  const activity = useWalletActivity({ ecosystem: wallet.ecosystem, address: wallet.address, chainId: wallet.chainId, solanaNetworkName: wallet.solanaNetworkName })
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | EvmKind>('all')
  const [time, setTime] = useState<TimeFilter>('all')

  const { target } = activity
  const ready = target.kind === 'ready'
  const evmChainId = target.kind === 'ready' && target.ecosystem === 'evm' ? target.chainId : null
  const networkName = evmChainId !== null ? ACTIVITY_CHAINS[evmChainId].name : target.kind === 'ready' ? 'Solana Devnet' : null

  // Rows are rebuilt from the CURRENT hook output only, so they always belong to the selected account and network.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const evmItems = activity.ecosystem === 'evm' ? activity.items : null
  const solItems = activity.ecosystem === 'solana' ? activity.items : null
  const evmRows: EvmRowView[] = useMemo(
    () => (evmItems && target.kind === 'ready' && target.ecosystem === 'evm' ? filterEvm(evmItems, { kind, time, query }, now).map((item) => buildEvmRow(item, target.address, target.chainId, now)) : []),
    [evmItems, target, kind, time, query, now],
  )
  const solRows: SolanaRowView[] = useMemo(() => (solItems ? filterSolana(solItems, { time, query }, now).map((item) => buildSolanaRow(item, now)) : []), [solItems, time, query, now])
  const visible: Array<EvmRowView | SolanaRowView> = evmItems ? evmRows : solRows

  const loadedCount = activity.items.length
  const todayCount = evmItems ? evmItems.filter((i) => timeGroup(i.timestamp, now) === 'Today').length : solItems ? solItems.filter((i) => timeGroup(solanaTimestamp(i), now) === 'Today').length : 0
  const kindCount = (k: EvmKind) => (evmItems ?? []).filter((i) => kindsFor(i).includes(k)).length
  const maxKind = Math.max(...EVM_KINDS.map(kindCount), 1)
  const failedCount = solItems ? solItems.filter((i) => i.status === 'failed').length : 0
  const okCount = solItems ? solItems.filter((i) => i.status === 'success').length : 0
  const hasFilters = kind !== 'all' || time !== 'all' || Boolean(query.trim())
  const reset = () => { setQuery(''); setKind('all'); setTime('all') }
  const plus = activity.hasMore ? '+' : ''

  let feed: React.ReactNode
  if (target.kind === 'no-wallet') {
    feed = <EmptyState title={wallet.status === 'connecting' ? 'Connecting wallet…' : 'Connect a wallet to see its activity'} body="Activity is read from the chain for the wallet you connect. Only your public address is used, and nothing is ever signed or sent." action={wallet.status === 'connecting' ? undefined : <button type="button" onClick={() => void wallet.connect()} className="text-sm text-copper hover:underline">Connect wallet</button>} />
  } else if (target.kind === 'invalid-address') {
    feed = <EmptyState title="Unsupported wallet address" body="The connected account’s address is not in a format NEXORA can read activity for." />
  } else if (target.kind === 'unknown-network') {
    feed = <EmptyState title="Network not detected" body="Your wallet did not report which network it is on. Switch networks in your wallet to load activity." />
  } else if (target.kind === 'unsupported-network') {
    feed = <EmptyState title="Network not supported for activity" body={`${target.reason} Supported EVM networks: ${Object.values(ACTIVITY_CHAINS).map((c) => c.name).join(', ')}, plus Solana Devnet. Switch network in your wallet to continue.`} />
  } else if (activity.error && !activity.loaded) {
    const missing = activity.error.kind === 'not-configured' || activity.error.kind === 'proxy-missing'
    feed = <ErrorState title={missing ? 'Activity is not set up' : activity.error.kind === 'chain-unsupported' ? 'Network not available from the provider' : 'Activity could not be loaded'} body={activity.error.message} onRetry={activity.error.retryable || missing ? activity.refresh : undefined} />
  } else if (activity.loading && !activity.loaded) {
    feed = <div className="nxa-skeleton" aria-hidden>{Array.from({ length: 5 }, (_, i) => <div key={i} className="nx-skeleton" />)}</div>
  } else if (activity.loaded && loadedCount === 0 && !activity.hasMore) {
    feed = <EmptyState title="No activity found" body={target.ecosystem === 'evm' ? `The provider returned no native, token or NFT transfers sent or received by this address on ${networkName}. Internal transfers are not included, and activity on other networks appears when you switch networks.` : 'The provider returned no transactions for this address on Solana Devnet. Receive some Devnet SOL from a faucet, or send a transfer, and it will appear here.'} />
  } else if (visible.length === 0 && !activity.hasMore) {
    feed = <EmptyState title="No events match" body="Try another type or time range, or clear the search." action={<button type="button" onClick={reset} className="text-sm text-copper hover:underline">Reset filters</button>} />
  } else {
    feed = (
      <>
        {activity.error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-mute">
            <CircleAlert className="size-4 text-ember" aria-hidden /><span className="flex-1">{activity.error.message} Showing the last loaded activity.</span>
            {activity.error.retryable ? <button type="button" onClick={activity.refresh} className="text-copper hover:underline">Retry</button> : null}
          </div>
        ) : null}
        {visible.length === 0 ? (
          <EmptyState title="No loaded events match" body="Nothing in the pages loaded so far matches these filters. Load more history or clear the filters." action={<button type="button" onClick={reset} className="text-sm text-copper hover:underline">Reset filters</button>} />
        ) : GROUPS.map((group) => {
          const items = (visible as Array<{ group: TimeGroup }>).filter((row) => row.group === group)
          if (items.length === 0) return null
          return (
            <section key={group} aria-label={group} className="nxa-group">
              <h2 className="nxa-group__head"><span>{group}</span><b>{items.length}</b></h2>
              <ol className="nxa-timeline">
                {evmItems
                  ? (items as EvmRowView[]).map((row, i) => <EvmEventRow key={row.id} row={row} chainId={evmChainId ?? 0} index={i} />)
                  : (items as SolanaRowView[]).map((row, i) => <SolanaEventRow key={row.id} row={row} index={i} />)}
              </ol>
            </section>
          )
        })}
        <div className="flex flex-col items-start gap-2">
          {activity.moreError ? (
            <p role="alert" className="flex items-center gap-2 text-sm text-mute"><CircleAlert className="size-4 text-ember" aria-hidden />{activity.moreError.message}</p>
          ) : null}
          {activity.hasMore ? (
            <button type="button" onClick={activity.loadMore} disabled={activity.loadingMore} className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-ink transition-colors hover:border-copper/50 disabled:opacity-60">
              {activity.loadingMore ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
              {activity.loadingMore ? 'Loading…' : activity.moreError ? 'Retry loading older activity' : 'Load older activity'}
            </button>
          ) : <p className="text-[12px] text-mute">End of available history.</p>}
        </div>
      </>
    )
  }

  const stats = evmItems
    ? [['Loaded', `${loadedCount}${plus}`], ['Today', String(todayCount)], ['Network', networkName ?? '—'], ['Types', String(EVM_KINDS.filter((k) => kindCount(k) > 0).length)]]
    : solItems
      ? [['Loaded', `${loadedCount}${plus}`], ['Today', String(todayCount)], ['Failed', String(failedCount)], ['Network', 'Solana Devnet']]
      : [['Loaded', '—'], ['Today', '—'], ['Network', networkName ?? '—'], ['Types', '—']]

  return (
    <div className="nxa-page">
      <header className="nxa-head">
        <div>
          <p className="nx-kicker">Activity explorer</p>
          <h1 className="nxa-head__title">Activity</h1>
          <p className="nxa-head__note">
            {activity.ecosystem === 'solana'
              ? 'Recent Solana Devnet transactions for your connected wallet, read from the chain. Direction and SOL amounts are shown only when the transaction is a plain transfer; anything else shows its status and the wallet’s net balance change, and the explorer has the full detail.'
              : 'Native, token and NFT transfers sent or received by your connected wallet on its current network, read from the chain and grouped per transaction. Read-only: nothing is signed or sent.'}
          </p>
        </div>
        <dl className="nxa-head__stats" aria-label="Feed summary">
          {stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </header>

      <div className="nxa-bar nx-sticky-bar">
        <SearchField value={query} onChange={setQuery} placeholder={activity.ecosystem === 'solana' ? 'Search signature or address' : 'Search hash, address, asset'} label="Search activity" className="nxa-bar__search" />
        {activity.ecosystem === 'evm' ? (
          <Segmented<'all' | EvmKind>
            label="Activity type"
            value={kind}
            onChange={setKind}
            options={[{ value: 'all', label: 'All', count: loadedCount }, ...EVM_KINDS.map((k) => ({ value: k, label: EVM_KIND_LABEL[k], count: kindCount(k) }))]}
          />
        ) : null}
        <Segmented<TimeFilter>
          label="Time range"
          value={time}
          onChange={setTime}
          options={[{ value: 'all', label: 'Any time' }, { value: 'Today', label: 'Today' }, { value: 'Earlier', label: 'Earlier' }]}
        />
        {networkName ? <span className="nxa-bar__network" aria-label="Network">{networkName}</span> : null}
      </div>

      <div className="nxa-layout">
        <div className="nxa-feed" aria-busy={ready && activity.loading}>{feed}</div>

        <aside className="nxa-side" aria-label="Feed breakdown">
          <p className="nx-eyebrow">{activity.ecosystem === 'solana' ? 'Status' : 'Event mix'}</p>
          {activity.ecosystem === 'solana' ? (
            <ul className="nxa-mix">
              {([['Success', okCount, 'is-sol'], ['Failed', failedCount, 'is-failed']] as const).map(([label, count, cls]) => (
                <li key={label}><div className={cn('nxa-mix__row', cls)}><span className="nxa-mix__name">{label}</span><b>{count}</b><span className="nxa-mix__bar"><i style={{ width: `${(count / Math.max(okCount, failedCount, 1)) * 100}%` }} /></span></div></li>
              ))}
            </ul>
          ) : (
            <ul className="nxa-mix">
              {EVM_KINDS.map((k) => (
                <li key={k}>
                  <button type="button" aria-pressed={kind === k} disabled={activity.ecosystem !== 'evm'} onClick={() => setKind(kind === k ? 'all' : k)} className={cn('nxa-mix__row', `is-${k}`)}>
                    <span className="nxa-mix__name">{EVM_KIND_ICON[k]}{EVM_KIND_LABEL[k]}</span>
                    <b>{kindCount(k)}</b>
                    <span className="nxa-mix__bar"><i style={{ width: `${(kindCount(k) / maxKind) * 100}%` }} /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="nxa-side__note">
            {activity.ecosystem === 'solana'
              ? 'Counts cover the pages loaded so far. Status comes from the transaction’s error field and confirmation level; Devnet SOL has no monetary value.'
              : 'Counts cover the pages loaded so far; one transaction can appear under several types. Internal transfers are not included, and transaction success/failure is not reported by this provider.'}
          </p>
          {ready ? <button type="button" onClick={activity.refresh} disabled={activity.loading} className="nxa-side__reset inline-flex items-center gap-1.5"><RefreshCw size={12} className={activity.loading ? 'animate-spin' : ''} aria-hidden /> Refresh</button> : null}
          {hasFilters ? <button type="button" onClick={reset} className="nxa-side__reset block">Reset filters</button> : null}
        </aside>
      </div>
    </div>
  )
}
