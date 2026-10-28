import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { CardGridSkeleton } from '@/components/shared/loading-state'
import { EmptyState } from '@/components/shared/empty-state'
import { catalog } from '@/data/catalog'
import { categories, type CollectionSort } from '@/data/selectors'
import type { CollectionCategory, NetworkId } from '@/data/types'
import { useLiveCollections } from '@/hooks/use-live-collections'
import { dur, ease } from '@/lib/motion'
import { fromDemoCollection } from '@/lib/nft-data/collections'
import { filterListed } from '@/lib/nft-data/listing'
import type { ListedCollection } from '@/lib/nft-data/types'
import { CollectionsDataStatus } from '@/features/collections/components/collections-data-status'
import { CollectionsMasthead } from '@/features/collections/components/collections-masthead'
import { CollectionLedger } from '@/features/collections/components/collection-ledger'
import { CollectionSpotlight } from '@/features/collections/components/collection-spotlight'
import { CollectionTile } from '@/features/collections/components/collection-tile'
import { DirectoryToolbar, type CollectionView } from '@/features/collections/components/directory-toolbar'
import './collections-page.css'

const NO_ROWS: ListedCollection[] = []
const SORTS: CollectionSort[] = ['volume', 'floor', 'items', 'name']

/**
 * Collections: a curated marketplace. A spotlight + trending zone sits above a
 * filterable directory. Filter state lives in the URL
 * (?category=art&network=solana&q=…&sort=floor&view=list) so slices stay
 * shareable and Discover can deep-link into the catalogue.
 *
 * Data: live OpenSea collections via the `/api/collections` proxy. The demo catalogue is shown only when the
 * user explicitly switches to it, and is labelled as demo. Search, filters and counts apply to the loaded set.
 */
export function CollectionsPage() {
  const live = useLiveCollections()
  const [useDemo, setUseDemo] = useState(false)
  const mode = useDemo ? 'demo' : 'live'
  const demoRows = useMemo(() => catalog.collections.map(fromDemoCollection), [])
  const rows = useDemo ? demoRows : live.snapshot?.collections ?? NO_ROWS
  const loading = !useDemo && live.status === 'loading'
  const failed = !useDemo && live.status === 'error'
  const [params, setParams] = useSearchParams()

  // URL → validated state
  const query = params.get('q') ?? ''
  const rawCategory = params.get('category')
  const category: CollectionCategory | 'all' = categories.includes(rawCategory as CollectionCategory) ? (rawCategory as CollectionCategory) : 'all'
  const rawNetwork = params.get('network')
  const network: NetworkId | 'all' = catalog.networks.some((n) => n.id === rawNetwork) ? (rawNetwork as NetworkId) : 'all'
  const rawSort = params.get('sort')
  const sort: CollectionSort = SORTS.includes(rawSort as CollectionSort) ? (rawSort as CollectionSort) : 'volume'
  const view: CollectionView = params.get('view') === 'list' ? 'list' : 'grid'

  const patch = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === 'all') next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  const results = useMemo(() => filterListed(rows, { query, network, category, sort }), [rows, query, network, category, sort])
  const ranked = useMemo(() => filterListed(rows, { query: '', network: 'all', category: 'all', sort: 'volume' }), [rows])

  const categoryOptions = useMemo(() => {
    const base = filterListed(rows, { query, network, category: 'all', sort: 'name' })
    return [
      { value: 'all' as const, label: 'All', count: base.length },
      ...categories.map((c) => ({ value: c, label: c, count: base.filter((i) => i.category === c).length })),
    ]
  }, [rows, query, network])

  const networkCounts = useMemo(() => {
    const base = filterListed(rows, { query, network: 'all', category, sort: 'name' })
    const counts: Record<string, number> = { all: base.length }
    for (const n of catalog.networks) counts[n.id] = base.filter((i) => i.networkId === n.id).length
    return counts
  }, [rows, query, category])

  const hasFilters = Boolean(query.trim()) || network !== 'all' || category !== 'all'
  const reset = () => patch({ q: null, category: null, network: null, sort: null })
  const networkName = catalog.networks.find((n) => n.id === network)?.name

  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(query.trim() ? [{ key: 'q', label: `“${query.trim()}”`, clear: () => patch({ q: null }) }] : []),
    ...(category !== 'all' ? [{ key: 'category', label: category, clear: () => patch({ category: null }) }] : []),
    ...(network !== 'all' ? [{ key: 'network', label: networkName ?? network, clear: () => patch({ network: null }) }] : []),
  ]

  const statusStrip = (
    <CollectionsDataStatus
      mode={mode} snapshot={live.snapshot} error={live.status === 'ready' ? live.error : null}
      refreshing={live.refreshing} onRefresh={live.retry} onUseLive={() => setUseDemo(false)}
    />
  )

  if (loading || failed) {
    return (
      <div className="nxc-page">
        <header className="nxc-compact-head">
          <div>
            <p className="nx-kicker">Marketplace</p>
            <h1 className="nxc-compact-head__title">Collections</h1>
          </div>
        </header>
        {loading ? (
          <>
            <div className="nxc-spotlight-skeleton nx-skeleton" aria-hidden />
            <CardGridSkeleton />
          </>
        ) : (
          <EmptyState
            title="Live collection data unavailable"
            body={live.error ?? 'No collection data could be loaded.'}
            action={(
              <span className="flex items-center gap-4">
                <button type="button" onClick={live.retry} disabled={live.refreshing} className="text-sm text-copper hover:underline disabled:opacity-60">{live.refreshing ? 'Retrying…' : 'Retry'}</button>
                <button type="button" onClick={() => setUseDemo(true)} className="text-sm text-mute hover:underline">View demo data</button>
              </span>
            )}
          />
        )}
      </div>
    )
  }

  return (
    <div className="nxc-page">
      {/* Featured zone: hidden while filtering so results rise to the top */}
      {hasFilters ? (
        <header className="nxc-compact-head">
          <div>
            <p className="nx-kicker">Marketplace</p>
            <h1 className="nxc-compact-head__title">Collections</h1>
          </div>
          <button type="button" onClick={reset} className="nxc-link">Back to featured</button>
        </header>
      ) : (
        <>
          <CollectionsMasthead ranked={ranked} onCategory={(value) => patch({ category: value })} />
          <div className="nxc-rule"><span><b>01</b>Featured</span></div>
          <CollectionSpotlight ranked={ranked} />
        </>
      )}

      <section aria-labelledby="nxc-directory-title" className="nxc-directory">
        <div className="nxc-rule"><span><b>02</b>Browse</span></div>
        {statusStrip}
        <div className="nxc-directory__head">
          <h2 id="nxc-directory-title" className="nxc-directory__title">{hasFilters ? 'Results' : 'All collections'}</h2>
          <span className="nxc-directory__count" aria-live="polite"><b>{results.length}</b> of {rows.length}</span>
        </div>

        <DirectoryToolbar
          query={query} onQuery={(v) => patch({ q: v })}
          network={network} onNetwork={(v) => patch({ network: v })}
          networks={catalog.networks} networkCounts={networkCounts} total={rows.length}
          sort={sort} onSort={(v) => patch({ sort: v })}
          view={view} onView={(v) => patch({ view: v === 'grid' ? null : v })}
          category={category} onCategory={(v) => patch({ category: v })} categoryOptions={categoryOptions}
        />

        <AnimatePresence initial={false}>
          {chips.length ? (
            <motion.div key="chips" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: dur.base, ease }} className="overflow-hidden">
              <div className="nxc-chips">
                {chips.map((chip) => (
                  <button key={chip.key} type="button" onClick={chip.clear} aria-label={`Remove filter ${chip.label}`} className="nxc-chip">
                    {chip.label}<X className="size-3 text-mute" />
                  </button>
                ))}
                <button type="button" onClick={reset} className="nxc-link">Clear all</button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {results.length === 0 ? (
          <EmptyState title="No collections found" body="Try another search term or clear one of the active filters." action={<button type="button" onClick={reset} className="text-sm text-copper hover:underline">Clear filters</button>} />
        ) : view === 'grid' ? (
          <div className="nxc-grid">
            {results.map((collection, index) => (
              <motion.div key={collection.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.slow, ease, delay: Math.min(index, 10) * 0.025 }} className="min-w-0">
                <CollectionTile collection={collection} />
              </motion.div>
            ))}
          </div>
        ) : (
          <CollectionLedger rows={results} sort={sort} onSort={(key) => patch({ sort: key })} />
        )}
      </section>
    </div>
  )
}
