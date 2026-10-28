import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/shared/empty-state'
import { catalog } from '@/data/catalog'
import type { NetworkId } from '@/data/types'
import { DropsHeader } from '@/features/workspaces/drops/components/drops-header'
import { DropsCommandBar } from '@/features/workspaces/drops/components/drops-command-bar'
import { AirdropBoard } from '@/features/workspaces/drops/components/airdrop-board'
import { EndedLedger } from '@/features/workspaces/drops/components/ended-ledger'
import { LaunchTimeline } from '@/features/workspaces/drops/components/launch-timeline'
import { LiveSpotlight } from '@/features/workspaces/drops/components/live-spotlight'
import { matchAirdrops, matchCampaigns, rewardOptions, type DropSort, type StatusFilter } from '@/features/workspaces/drops/drops-data'
import './drops/drops-page.css'

/**
 * Drops & Airdrops: a launch calendar. Time-sensitive campaigns come first
 * (live spotlight, upcoming timeline, ended archive); airdrop records live on a
 * separate research board. Owns its page heading
 * (WorkspacePageFrame skips the generic one).
 */
export function DropsWorkspace() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [network, setNetwork] = useState<NetworkId | 'all'>('all')
  const [reward, setReward] = useState('all')
  const [sort, setSort] = useState<DropSort>('catalog')

  const rewards = useMemo(() => rewardOptions(), [])
  const matching = useMemo(() => matchCampaigns({ query, network, reward, sort }), [query, network, reward, sort])
  const airdrops = useMemo(() => matchAirdrops({ query, network, reward }).filter((a) => status === 'all' || String(a.status) === status), [query, network, reward, status])

  const counts: Record<StatusFilter, number> = {
    all: matching.length,
    live: matching.filter((c) => c.status === 'live').length,
    upcoming: matching.filter((c) => c.status === 'upcoming').length,
    ended: matching.filter((c) => c.status === 'ended').length,
  }
  const show = (s: 'live' | 'upcoming' | 'ended') => (status === 'all' || status === s ? matching.filter((c) => c.status === s) : [])
  const hasFilters = Boolean(query.trim()) || status !== 'all' || network !== 'all' || reward !== 'all' || sort !== 'catalog'
  const reset = () => { setQuery(''); setStatus('all'); setNetwork('all'); setReward('all'); setSort('catalog') }
  const nothing = counts[status] === 0 && airdrops.length === 0

  return (
    <div className="nxd-page">
      <DropsHeader />

      <DropsCommandBar
        counts={counts}
        status={status} onStatus={setStatus}
        query={query} onQuery={setQuery}
        network={network} onNetwork={setNetwork} networks={catalog.networks}
        reward={reward} onReward={setReward} rewards={rewards}
        sort={sort} onSort={setSort}
        hasFilters={hasFilters} onReset={reset}
      />

      {nothing ? (
        <EmptyState title="No campaigns found" body="Try another search, network, reward or status." action={<button type="button" onClick={reset} className="text-sm text-copper hover:underline">Reset filters</button>} />
      ) : (
        <>
          <LiveSpotlight live={show('live')} />
          <LaunchTimeline upcoming={show('upcoming')} />
          <EndedLedger ended={show('ended')} />
          <AirdropBoard airdrops={airdrops} total={matchAirdrops({ query: '', network: 'all', reward: 'all' }).length} />
        </>
      )}
    </div>
  )
}
