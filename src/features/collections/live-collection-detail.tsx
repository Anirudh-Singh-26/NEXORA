import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUpRight, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/shared/empty-state'
import { NetworkChip } from '@/components/shared/network-chip'
import { ParallaxBanner } from '@/components/shared/parallax-banner'
import { Reveal } from '@/components/shared/reveal'
import { SectionHeader } from '@/components/shared/section-header'
import { Segmented } from '@/components/shared/segmented'
import { Button } from '@/components/ui/button'
import { CollectionArt } from '@/features/collections/components/collection-parts'
import { LiveActivityPanel } from '@/features/collections/live/live-activity'
import { IntervalTable, TraitGrid } from '@/features/collections/live/live-about'
import { LiveInsights } from '@/features/collections/live/live-insights'
import { LiveItemsPanel } from '@/features/collections/live/live-items'
import { LiveRelated } from '@/features/collections/live/live-related'
import { Note } from '@/features/collections/live/live-ui'
import { useCollectionItems } from '@/hooks/use-collection-items'
import { useLiveCollection } from '@/hooks/use-live-collection'
import { dur, ease, rise, stagger, useMotionReduced } from '@/lib/motion'
import { COLLECTIONS_SOURCE } from '@/lib/nft-data/collections'
import type { LiveCollectionDetail as LiveDetail, LiveCollectionDetailSnapshot } from '@/lib/nft-data/collection-detail'
import { sortItemsByPrice } from '@/lib/nft-data/collection-extras'
import { fmtCount, fmtFloor, fmtVolume, NO_VALUE } from '@/lib/nft-data/format'

type Tab = 'items' | 'activity' | 'about'
type ItemSort = 'default' | 'low' | 'high'

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : NO_VALUE)
const prettyNetwork = (id: string) => id.charAt(0).toUpperCase() + id.slice(1)
const unit = (c: LiveDetail) => c.floor?.symbol ?? c.volume24h?.symbol ?? c.stats?.totalVolume?.symbol ?? null

const BackLink = () => (
  <Button asChild variant="outline"><Link to="/collections">Back to collections</Link></Button>
)

/**
 * In-app detail page for a live (OpenSea) collection at /collections/:slug?source=opensea.
 * Layout follows the NEXORA demo detail page (hero → stat strip → Items / Activity / About beside a properties
 * sidebar → insights → related). Every figure comes from the OpenSea proxies; anything not supplied shows "—".
 */
export function LiveCollectionDetail({ slug }: { slug: string }) {
  const live = useLiveCollection(slug)

  if (live.status === 'loading') {
    return (
      <div className="space-y-6" role="status" aria-label="Loading collection">
        <div className="nx-skeleton h-[230px] rounded-2xl md:h-[300px]" aria-hidden />
        <div className="nx-skeleton h-24 rounded-xl" aria-hidden />
        <div className="nx-skeleton h-20 rounded-xl" aria-hidden />
      </div>
    )
  }

  if (live.status === 'not-found') {
    return <EmptyState title="Collection not found" body="Neither NEXORA’s demo set nor OpenSea has a collection at this address." action={<BackLink />} />
  }

  if (live.status === 'error' || !live.snapshot) {
    return (
      <EmptyState
        title="Collection data unavailable"
        body={live.error ?? 'This collection could not be loaded.'}
        action={(
          <span className="flex items-center gap-4">
            <button type="button" onClick={live.retry} disabled={live.refreshing} className="text-sm text-copper hover:underline disabled:opacity-60">{live.refreshing ? 'Retrying…' : 'Retry'}</button>
            <Link to="/collections" className="text-sm text-mute hover:underline">Back to collections</Link>
          </span>
        )}
      />
    )
  }

  return <LiveCollectionBody slug={slug} snap={live.snapshot} refreshing={live.refreshing} error={live.error} onRefresh={live.retry} />
}

function LiveCollectionBody({ slug, snap, refreshing, error, onRefresh }: { slug: string; snap: LiveCollectionDetailSnapshot; refreshing: boolean; error: string | null; onRefresh: () => void }) {
  const reduced = useMotionReduced()
  const c = snap.collection
  const itemsState = useCollectionItems(slug)
  const [tab, setTab] = useState<Tab>('items')
  const [sort, setSort] = useState<ItemSort>('default')
  const missing = new Set(snap.unavailable)
  const quote = unit(c)

  const shownItems = useMemo(
    () => (sort === 'default' ? itemsState.items : sortItemsByPrice(itemsState.items, itemsState.listings, itemsState.lastSales, sort === 'low' ? 'asc' : 'desc')),
    [sort, itemsState.items, itemsState.listings, itemsState.lastSales],
  )

  const holdRatio = c.items && c.owners ? Math.round((c.owners / c.items) * 100) : null
  const stats: [string, string, string?][] = [
    ['Floor', fmtFloor(c.floor)],
    ['24h volume', fmtVolume(c.volume24h)],
    ['24h sales', fmtCount(c.sales24h)],
    ['Items', fmtCount(c.items)],
    ['Owners', fmtCount(c.owners), holdRatio === null ? undefined : `${holdRatio}% of supply`],
  ]
  const allTime: [string, string][] = [
    ['Total volume', fmtVolume(c.stats?.totalVolume ?? null)],
    ['Total sales', fmtCount(c.stats?.totalSales ?? null)],
    ['Average price', fmtVolume(c.stats?.averagePrice ?? null)],
    ['Market cap', fmtVolume(c.stats?.marketCap ?? null)],
    ['Floor price', fmtFloor(c.floor)],
  ]
  const links: [string, string | null][] = [
    ['Website', c.links.projectUrl], ['Wiki', c.links.wikiUrl], ['Discord', c.links.discordUrl],
    ['Telegram', c.links.telegramUrl], ['X (Twitter)', c.links.twitterUrl], ['Instagram', c.links.instagramUrl],
  ]
  const shownLinks = links.filter((l): l is [string, string] => l[1] !== null)
  const properties: [string, React.ReactNode][] = [
    ['Collection ID', <span className="font-mono text-[11.5px]" key="id">{c.slug}</span>],
    ['Category', c.category ? <span className="capitalize" key="c">{c.category.replace(/[-_]/g, ' ')}</span> : NO_VALUE],
    ['Network', c.networkId ? <NetworkChip key="n" id={c.networkId} /> : NO_VALUE],
    ['Owner', c.creator ? <span key="o" title={c.ownerAddress ?? undefined}>{c.creator}</span> : NO_VALUE],
    ['Supply', c.items === null ? NO_VALUE : `${c.items.toLocaleString('en-US')} items`],
    ['Holders', c.owners === null ? NO_VALUE : c.owners.toLocaleString('en-US')],
    ['Quote asset', quote ?? NO_VALUE],
    ['Created', fmtDate(c.createdDate)],
    ['Verification', c.verified === null ? NO_VALUE : c.verified ? 'Verified on OpenSea' : 'Not verified'],
  ]

  const browse = () => document.getElementById('nx-items')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  const refreshAll = () => { onRefresh(); itemsState.retry() }
  const busy = refreshing || itemsState.refreshing

  return (
    <div className="space-y-9">
      <motion.div initial="hidden" animate="show" variants={stagger(0.07)}>
        {/* Identity: immersive banner + overlapping identity row */}
        <motion.section variants={rise} className="relative">
          <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/[0.07] [mask-image:linear-gradient(#000_62%,transparent)]">
            {c.banner ?? c.cover ? (
              <ParallaxBanner src={(c.banner ?? c.cover) as string} fallbackLabel={c.name.slice(0, 2)} className="h-[230px] md:h-[300px]">
                <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/30 to-canvas/40" />
                <div className="absolute inset-0 bg-gradient-to-r from-canvas/70 via-transparent to-transparent" />
              </ParallaxBanner>
            ) : (
              <div className="mesh-fallback h-[230px] md:h-[300px]" aria-hidden />
            )}
            <nav aria-label="Breadcrumb" className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-white/10 bg-canvas/60 px-3 py-1 text-[11.5px] text-mute backdrop-blur md:left-5">
              <Link to="/collections" className="transition-colors hover:text-ink">Collections</Link>
              <ChevronRight className="size-3 text-mute/50" />
              <span className="max-w-[40vw] truncate text-ink">{c.name}</span>
            </nav>
          </div>

          <div className="relative z-10 -mt-16 grid items-end gap-5 px-4 md:-mt-20 md:px-7 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
            <div className="group size-28 shrink-0 md:size-36">
              <CollectionArt
                src={c.cover} alt={c.name} fallbackLabel={c.name.slice(0, 2)} shade="none"
                className="size-full rounded-2xl border-[3px] border-canvas shadow-[0_20px_44px_-16px_rgba(0,0,0,0.9),0_0_0_1px_rgba(169,154,255,0.25)]"
              />
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                {c.networkId ? <NetworkChip id={c.networkId} /> : null}
                {c.category ? <span className="nx-eyebrow capitalize text-copper">{c.category.replace(/[-_]/g, ' ')}</span> : null}
                {c.verified ? <span className="nx-eyebrow">Verified</span> : null}
                <span className="nx-eyebrow">Live data</span>
              </div>
              <h1 className="mt-2 font-display text-[clamp(1.7rem,3vw,2.4rem)] font-semibold leading-none tracking-[-0.04em]">{c.name}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-mute">
                {c.creator ? <span>by <span className="text-ink/90" title={c.ownerAddress ?? undefined}>{c.creator}</span></span> : null}
                <span className="font-mono text-[11.5px]" title="OpenSea collection identifier">opensea/{c.slug}</span>
              </p>
              <p className="mt-3 line-clamp-3 max-w-2xl whitespace-pre-line text-[13px] leading-6 text-mute">{c.description ?? 'No description provided.'}</p>
            </div>
            <div className="nx-panel w-full rounded-xl p-4 lg:w-60">
              <p className="nx-eyebrow">Floor price</p>
              <p className="mt-1 font-mono text-[26px] font-medium leading-none tabular-nums">{fmtFloor(c.floor)}</p>
              <p className="mt-2 text-[11.5px] text-mute">{fmtVolume(c.volume24h)} 24h volume</p>
              <Button className="mt-3.5 w-full" onClick={browse}>
                Browse items <ArrowDown className="size-4" />
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
                <a href={c.openseaUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${c.name} on OpenSea (opens in a new tab)`}>
                  View on OpenSea <ArrowUpRight className="size-4" aria-hidden />
                </a>
              </Button>
            </div>
          </div>
        </motion.section>

        {/* One continuous stat strip */}
        <motion.dl variants={rise} className="mt-7 grid grid-cols-2 divide-x divide-y divide-line/70 overflow-hidden rounded-xl border border-line/80 bg-raised/60 sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          {stats.map(([label, value, hint]) => (
            <div key={label} className="px-4 py-3.5">
              <dt className="nx-eyebrow text-[9.5px]">{label}</dt>
              <dd className="mt-1.5 font-mono text-[17px] leading-none tabular-nums">{value}</dd>
              {hint ? <p className="mt-1.5 text-[10.5px] text-mute">{hint}</p> : <p className="mt-1.5 text-[10.5px] text-transparent" aria-hidden>.</p>}
            </div>
          ))}
        </motion.dl>

        <div role="status" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-mute">
          <span className="font-medium text-ink">Live collection data</span>
          <span>
            Data from <a href={COLLECTIONS_SOURCE.url} target="_blank" rel="noopener noreferrer" className="text-copper hover:underline">{COLLECTIONS_SOURCE.name}</a>
          </span>
          <span>Updated {time(snap.fetchedAt)}</span>
          {itemsState.fetchedAt ? <span>Items updated {time(itemsState.fetchedAt)}</span> : null}
          <button type="button" onClick={refreshAll} disabled={busy} className="text-copper hover:underline disabled:opacity-60">{busy ? 'Refreshing…' : 'Refresh'}</button>
          {snap.partial ? <span>Some sections were unavailable and show “—” or a notice.</span> : null}
          {error ? <span className="text-loss">Refresh failed — showing earlier data. {error}</span> : null}
        </div>
      </motion.div>

      {/* Body: tabs + sidebar */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section id="nx-items" className="min-w-0 scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented<Tab>
              label="Collection sections"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'items', label: 'Items', ...(itemsState.items.length ? { count: itemsState.items.length } : {}) },
                { value: 'activity', label: 'Activity' },
                { value: 'about', label: 'About' },
              ]}
            />
            {tab === 'items' && itemsState.items.length > 1 ? (
              <Segmented<ItemSort>
                label="Sort loaded items"
                value={sort}
                onChange={setSort}
                options={[{ value: 'default', label: 'Default' }, { value: 'low', label: 'Lowest price' }, { value: 'high', label: 'Highest price' }]}
              />
            ) : null}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: dur.base, ease }}>
              {tab === 'items' ? (
                <div className="space-y-4">
                  <SectionHeader
                    kicker="COLLECTION ITEMS"
                    title={`NFTs in ${c.name}`}
                    description="Real items from OpenSea. Prices appear only where OpenSea supplied a listing or recent sale; sorting applies to the items loaded so far."
                  />
                  <LiveItemsPanel state={itemsState} items={shownItems} collectionName={c.name} />
                </div>
              ) : null}

              {tab === 'activity' ? (
                <div className="space-y-4">
                  <SectionHeader kicker="ACTIVITY" title="Recent collection activity" description="Live sales, listings and transfers reported by OpenSea." />
                  <LiveActivityPanel slug={slug} collectionName={c.name} />
                </div>
              ) : null}

              {tab === 'about' ? (
                <div className="space-y-9">
                  <section aria-label="About this collection">
                    <SectionHeader kicker="ABOUT" title={`About ${c.name}`} />
                    <div className="nx-surface space-y-3 rounded-xl p-5">
                      <p className="max-w-2xl whitespace-pre-line text-[13.5px] leading-7 text-ink/85">{c.description ?? 'No description provided.'}</p>
                    </div>
                  </section>

                  <section aria-label="Market statistics">
                    <SectionHeader kicker="MARKET STATISTICS" title="Collection-wide market data" description="Aggregates for the whole collection as reported by OpenSea, not for any single item. Changes compare each period with the one before it." />
                    {missing.has('stats') || !c.stats ? (
                      <Note>{missing.has('stats') ? 'OpenSea statistics could not be loaded just now. Use Refresh to try again.' : 'OpenSea did not supply market statistics for this collection.'}</Note>
                    ) : (
                      <div className="space-y-3.5">
                        <dl className="grid grid-cols-2 divide-x divide-y divide-line/70 overflow-hidden rounded-xl border border-line/80 bg-raised/60 sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
                          {allTime.map(([label, value]) => (
                            <div key={label} className="px-4 py-3.5">
                              <dt className="nx-eyebrow text-[9.5px]">{label}</dt>
                              <dd className="mt-1.5 font-mono text-[15px] leading-none tabular-nums">{value}</dd>
                            </div>
                          ))}
                        </dl>
                        <div className="nx-surface overflow-hidden rounded-xl">
                          <IntervalTable rows={[['24 hours', c.stats.intervals.oneDay], ['7 days', c.stats.intervals.sevenDay], ['30 days', c.stats.intervals.thirtyDay]]} />
                        </div>
                      </div>
                    )}
                  </section>

                  <section aria-label="Collection traits">
                    <SectionHeader kicker="TRAITS" title="Trait distribution" description="Collection-wide: how many items carry each trait value, as reported by OpenSea. These are not the attributes of any single NFT." />
                    {c.traits ? <TraitGrid traits={c.traits} /> : (
                      <Note>{missing.has('traits') ? 'Trait data could not be loaded just now. Use Refresh to try again.' : 'OpenSea did not supply trait data for this collection.'}</Note>
                    )}
                  </section>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </section>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-[calc(var(--nx-topbar)+16px)] lg:self-start" aria-label="Collection details">
          <div className="nx-panel rounded-xl p-4">
            <p className="nx-eyebrow mb-3">Properties</p>
            <dl className="space-y-2.5">
              {properties.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-line/60 pb-2.5 last:border-0 last:pb-0">
                  <dt className="shrink-0 text-[12px] text-mute">{label}</dt>
                  <dd className="min-w-0 truncate text-right text-[12.5px]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="nx-panel rounded-xl p-4">
            <p className="nx-eyebrow mb-3">Contracts</p>
            {c.contracts.length ? (
              <ul className="space-y-2.5">
                {c.contracts.map((ct) => (
                  <li key={`${ct.networkId ?? 'unknown'}:${ct.address}`} className="min-w-0">
                    <p className="text-[11px] text-mute">{ct.networkId ? prettyNetwork(ct.networkId) : 'Network —'}</p>
                    <p className="break-all font-mono text-[11.5px] leading-5">{ct.address}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[12.5px] text-mute">{NO_VALUE}</p>}
          </div>

          <div className="nx-panel rounded-xl p-4">
            <p className="nx-eyebrow mb-3">Collection fees</p>
            {c.fees.length ? (
              <ul className="space-y-2">
                {c.fees.map((f, idx) => (
                  <li key={`${f.recipient ?? 'fee'}:${idx}`} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="text-mute">{f.required ? 'Required' : 'Optional'}</span>
                    <span className="font-mono tabular-nums">{f.fee.toLocaleString('en-US', { maximumFractionDigits: 2 })}%</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[12.5px] text-mute">{NO_VALUE}</p>}
          </div>

          <div className="nx-panel rounded-xl p-4">
            <p className="nx-eyebrow mb-3">External links</p>
            {shownLinks.length ? (
              <ul className="space-y-2">
                {shownLinks.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1 text-[12.5px] text-ink/90 transition-colors hover:text-copper">
                      {label}<ArrowUpRight className="size-3.5 text-mute transition-transform group-hover:-translate-y-px group-hover:translate-x-0.5" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[12.5px] text-mute">{NO_VALUE}</p>}
          </div>
        </aside>
      </div>

      <Reveal>
        <LiveInsights stats={c.stats} listings={itemsState.listings} />
      </Reveal>

      <Reveal>
        <LiveRelated slug={c.slug} networkId={c.networkId} />
      </Reveal>
    </div>
  )
}
