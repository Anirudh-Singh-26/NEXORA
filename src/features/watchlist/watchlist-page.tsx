import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Search, X } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { Segmented } from '@/components/shared/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { catalog } from '@/data/catalog'
import type { NetworkId } from '@/data/types'
import { useWatchlistStore } from '@/store/watchlist-store'
import { WatchOverview } from '@/features/watchlist/components/watch-overview'
import { WatchTable } from '@/features/watchlist/components/watch-table'
import { buildWatchRows, KIND_LABEL, SORT_LABELS, sortRows, type WatchKind, type WatchSort } from '@/features/watchlist/watchlist-model'
import './watchlist-page.css'

const EMPTY: Record<WatchKind, { body: string; to: string; cta: string }> = {
  token: { body: 'No tokens saved. Bookmark a quote from the ranking to track it here.', to: '/tokens', cta: 'Browse tokens' },
  collection: { body: 'No collections saved. Pin one from the catalogue to follow its floor.', to: '/collections', cta: 'Browse collections' },
  asset: { body: 'No assets saved. Open a collection and bookmark an individual demo asset.', to: '/collections', cta: 'Open a collection' },
  campaign: { body: 'No campaigns saved. Save a drop or airdrop to keep its timing close.', to: '/drops', cta: 'Open drops' },
}

/**
 * Watchlist: a personal observatory. One comparable table for every saved type,
 * driven by the existing persisted watchlist store (read and toggled, never
 * rewritten). Figures come from the demo catalogue; no portfolio value exists.
 */
export function WatchlistPage() {
  const tokenIds = useWatchlistStore((s) => s.tokenIds)
  const collectionIds = useWatchlistStore((s) => s.collectionIds)
  const assetIds = useWatchlistStore((s) => s.assetIds)
  const campaignIds = useWatchlistStore((s) => s.campaignIds)

  const [kind, setKind] = useState<WatchKind | 'all'>('all')
  const [network, setNetwork] = useState<NetworkId | 'all'>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<WatchSort>('type')

  const all = useMemo(() => buildWatchRows({ tokenIds, collectionIds, assetIds, campaignIds }), [tokenIds, collectionIds, assetIds, campaignIds])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = all.filter(
      (r) => (kind === 'all' || r.kind === kind) && (network === 'all' || r.networkId === network) && (!q || `${r.name} ${r.sub} ${r.note ?? ''}`.toLowerCase().includes(q)),
    )
    return sortRows(filtered, sort)
  }, [all, kind, network, query, sort])

  const count = (k: WatchKind) => all.filter((r) => r.kind === k).length
  const hasFilters = kind !== 'all' || network !== 'all' || Boolean(query.trim())
  const reset = () => { setKind('all'); setNetwork('all'); setQuery('') }
  const networksUsed = useMemo(() => catalog.networks.filter((n) => all.some((r) => r.networkId === n.id)), [all])

  return (
    <div className="nxw-page">
      <header className="nxw-head">
        <div>
          <p className="nx-kicker">Personal observatory</p>
          <h1 className="nxw-head__title">Watchlist</h1>
          <p className="nxw-head__note">Everything you bookmark across NEXORA, side by side. Saved in this browser only — nothing is synced or tied to a wallet, and no portfolio value is calculated.</p>
        </div>
        <nav className="nxw-head__add" aria-label="Find more to track">
          <span className="nx-eyebrow">Track more</span>
          <Link to="/tokens">Tokens</Link><Link to="/collections">Collections</Link><Link to="/drops">Drops</Link>
        </nav>
      </header>

      <WatchOverview rows={all} kind={kind} onKind={setKind} network={network} onNetwork={setNetwork} />

      {all.length === 0 ? (
        <section className="nxw-empty">
          <span className="nxw-empty__icon"><Bookmark className="size-5" /></span>
          <h2>Nothing saved yet</h2>
          <p>Tap the bookmark on any token, collection, asset or drop and it will appear here, grouped by type.</p>
          <div className="nxw-empty__links">
            <Link to="/tokens">Tokens</Link><Link to="/collections">Collections</Link><Link to="/discover">Discover</Link><Link to="/drops">Drops</Link>
          </div>
        </section>
      ) : (
        <>
          <div className="nxw-bar nx-sticky-bar">
            <label className="nx-field nxw-search">
              <Search className="pointer-events-none absolute left-3 size-4 text-mute" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search saved items" aria-label="Search saved items" />
              {query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 rounded p-1 text-mute hover:text-ink"><X className="size-3.5" /></button> : null}
            </label>
            <Segmented<WatchKind | 'all'>
              label="Saved item type"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'all', label: 'All', count: all.length },
                { value: 'token', label: 'Tokens', count: count('token') },
                { value: 'collection', label: 'Collections', count: count('collection') },
                { value: 'asset', label: 'Assets', count: count('asset') },
                { value: 'campaign', label: 'Campaigns', count: count('campaign') },
              ]}
            />
            <Select value={network} onValueChange={(v) => setNetwork(v as NetworkId | 'all')}>
              <SelectTrigger className="h-9 w-[150px]" aria-label="Network"><SelectValue placeholder="Network" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All networks</SelectItem>
                {networksUsed.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as WatchSort)}>
              <SelectTrigger className="h-9 w-[190px]" aria-label="Sort saved items"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as WatchSort[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="nxw-bar__count" aria-live="polite"><b>{rows.length}</b> of {all.length}{hasFilters ? <button type="button" onClick={reset} className="nxw-bar__reset">Reset</button> : null}</span>
          </div>

          {rows.length > 0 ? (
            <WatchTable rows={rows} />
          ) : kind !== 'all' && count(kind) === 0 && network === 'all' && !query.trim() ? (
            <div className="nxw-prompt">
              <p>{EMPTY[kind].body}</p>
              <Link to={EMPTY[kind].to}>{EMPTY[kind].cta} →</Link>
            </div>
          ) : (
            <EmptyState
              title="No saved items match"
              body={`Nothing in ${kind === 'all' ? 'your watchlist' : `your saved ${KIND_LABEL[kind].toLowerCase()}s`} fits the current search or network filter.`}
              action={<button type="button" onClick={reset} className="text-sm text-copper hover:underline">Clear filters</button>}
            />
          )}
        </>
      )}
    </div>
  )
}
