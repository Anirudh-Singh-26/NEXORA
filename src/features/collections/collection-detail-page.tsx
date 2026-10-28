import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUpRight, ChevronRight } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { ChangeValue } from '@/components/shared/change-value'
import { CollectionCard } from '@/components/shared/collection-card'
import { CollectionInsights } from '@/components/shared/collection-insights'
import { EmptyState } from '@/components/shared/empty-state'
import { ItemCard } from '@/components/shared/item-card'
import { NetworkChip } from '@/components/shared/network-chip'
import { ParallaxBanner } from '@/components/shared/parallax-banner'
import { Reveal } from '@/components/shared/reveal'
import { SectionHeader } from '@/components/shared/section-header'
import { Segmented } from '@/components/shared/segmented'
import { Sparkline } from '@/components/shared/sparkline'
import { TokenGlyph } from '@/components/shared/token-glyph'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import { Button } from '@/components/ui/button'
import { LiveCollectionDetail } from '@/features/collections/live-collection-detail'
import { catalog } from '@/data/catalog'
import { getCollection, getToken } from '@/data/selectors'
import type { Collection } from '@/data/types'
import { formatCompact, formatFloor, formatUsd } from '@/lib/format'
import { dur, ease, stagger, rise, useMotionReduced } from '@/lib/motion'
import { cn } from '@/lib/utils'

type Tab = 'items' | 'activity' | 'about'
type ItemSort = 'default' | 'high' | 'low'

/**
 * Collection landing page. Deliberately unlike the browsing grid:
 * immersive banner → overlapping identity row with a floor panel → one stat
 * strip → tabbed Items / Activity / About beside a properties sidebar.
 * Everything shown is derived from the mock record (no invented figures).
 */
export function CollectionDetailPage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  // Live cards link to /collections/:slug?source=opensea. A bare slug also falls through to the live lookup when
  // it is not a demo collection, so direct URLs and refreshes work without any navigation state.
  const wantsLive = params.get('source') === 'opensea'
  const collection = slug && !wantsLive ? getCollection(slug) : undefined

  if (slug && !collection) return <LiveCollectionDetail key={slug} slug={slug} />

  if (!collection) {
    return (
      <EmptyState
        title="Collection not in the demo set"
        body="That slug is not part of the NEXORA catalog."
        action={
          <Button asChild variant="outline">
            <Link to="/collections">Back to collections</Link>
          </Button>
        }
      />
    )
  }

  // Remount per collection so tab / sort state resets when navigating between landings.
  return <CollectionLanding key={collection.id} collection={collection} />
}

function CollectionLanding({ collection }: { collection: Collection }) {
  const reduced = useMotionReduced()
  const [tab, setTab] = useState<Tab>('items')
  const [itemSort, setItemSort] = useState<ItemSort>('default')
  const linked = collection.linkedTokenId ? getToken(collection.linkedTokenId) : undefined

  const items = useMemo(() => {
    const list = [...collection.nfts]
    if (itemSort === 'high') list.sort((a, b) => b.lastSale - a.lastSale)
    if (itemSort === 'low') list.sort((a, b) => a.lastSale - b.lastSale)
    return list
  }, [collection.nfts, itemSort])

  const sales = collection.nfts.map((n) => n.lastSale)
  const avgSale = sales.length ? sales.reduce((a, b) => a + b, 0) / sales.length : 0
  const maxSale = Math.max(1, ...sales)
  const holdRatio = collection.items ? Math.round((collection.owners / collection.items) * 100) : 0

  const related = useMemo(() => {
    const others = catalog.collections.filter((c) => c.id !== collection.id)
    const same = others.filter((c) => c.category === collection.category || c.networkId === collection.networkId)
    return (same.length >= 3 ? same : [...same, ...others.filter((c) => !same.includes(c))]).sort((a, b) => b.volume24h - a.volume24h).slice(0, 4)
  }, [collection])

  const stats: [string, string, string?][] = [
    ['Floor', formatFloor(collection.floor, collection.floorSymbol)],
    ['24h volume', formatCompact(collection.volume24h)],
    ['Items', formatCompact(collection.items)],
    ['Owners', formatCompact(collection.owners), `${holdRatio}% of supply`],
    ['Avg last sale', `${avgSale.toFixed(2)} ${collection.floorSymbol}`, `sample of ${sales.length}`],
  ]

  const properties: [string, React.ReactNode][] = [
    ['Category', <span className="capitalize" key="c">{collection.category}</span>],
    ['Network', <NetworkChip key="n" id={collection.networkId} />],
    ['Studio', collection.creator],
    ['Supply', `${collection.items.toLocaleString('en-US')} items`],
    ['Holders', collection.owners.toLocaleString('en-US')],
    ['Quote asset', collection.floorSymbol],
    ['Metadata standard', collection.standard ?? 'Demo metadata'],
    ['Sample creator royalty', `${((collection.royaltyBps ?? 0) / 100).toFixed(2)}%`],
    ['Verification', collection.verificationStatus === 'verified' ? 'Verified' : 'Demo-only'],
  ]

  const browse = () => document.getElementById('nx-items')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })

  return (
    <div className="space-y-9">
      <motion.div initial="hidden" animate="show" variants={stagger(0.07)}>
        {/* Identity: immersive banner + overlapping identity row */}
        <motion.section variants={rise} className="relative">
          <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/[0.07] [mask-image:linear-gradient(#000_62%,transparent)]">
            <ParallaxBanner src={collection.banner} fallbackLabel={collection.name.slice(0, 2)} className="h-[230px] md:h-[300px]">
              <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/30 to-canvas/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-canvas/70 via-transparent to-transparent" />
            </ParallaxBanner>
            <nav aria-label="Breadcrumb" className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-white/10 bg-canvas/60 px-3 py-1 text-[11.5px] text-mute backdrop-blur md:left-5">
              <Link to="/collections" className="transition-colors hover:text-ink">Collections</Link>
              <ChevronRight className="size-3 text-mute/50" />
              <span className="max-w-[40vw] truncate text-ink">{collection.name}</span>
            </nav>
            <div className="absolute right-4 top-4 md:right-5"><WatchlistButton kind="collection" id={collection.id} /></div>
          </div>

          <div className="relative z-10 -mt-16 grid items-end gap-5 px-4 md:-mt-20 md:px-7 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
            <div className="group size-28 shrink-0 md:size-36">
              <ArtworkFrame
                src={collection.cover}
                alt={collection.name}
                fallbackLabel={collection.name.slice(0, 2)}
                shade="none"
                className="size-full rounded-2xl border-[3px] border-canvas shadow-[0_20px_44px_-16px_rgba(0,0,0,0.9),0_0_0_1px_rgba(169,154,255,0.25)]"
              />
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <NetworkChip id={collection.networkId} />
                <span className="nx-eyebrow text-copper">{collection.category}</span>
              </div>
              <h1 className="mt-2 font-display text-[clamp(1.7rem,3vw,2.4rem)] font-semibold leading-none tracking-[-0.04em]">{collection.name}</h1>
              <p className="mt-1.5 text-[12.5px] text-mute">by <span className="text-ink/90">{collection.creator}</span></p>
              <p className="mt-3 max-w-2xl text-[13px] leading-6 text-mute">{collection.description}</p>
            </div>
            <div className="nx-panel w-full rounded-xl p-4 lg:w-60">
              <p className="nx-eyebrow">Floor price</p>
              <p className="mt-1 font-mono text-[26px] font-medium leading-none tabular-nums">{formatFloor(collection.floor, collection.floorSymbol)}</p>
              <p className="mt-2 text-[11.5px] text-mute">{formatCompact(collection.volume24h)} 24h volume</p>
              <Button className="mt-3.5 w-full" onClick={browse}>
                Browse items <ArrowDown className="size-4" />
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
      </motion.div>

      {/* Body: tabs + sidebar */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section id="nx-items" className="min-w-0 scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented<Tab>
              label="Collection sections"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'items', label: 'Items', count: collection.nfts.length },
                { value: 'activity', label: 'Activity' },
                { value: 'about', label: 'About' },
              ]}
            />
            {tab === 'items' ? (
              <Segmented<ItemSort>
                label="Sort items"
                value={itemSort}
                onChange={setItemSort}
                options={[
                  { value: 'default', label: 'Default' },
                  { value: 'high', label: 'Highest sale' },
                  { value: 'low', label: 'Lowest sale' },
                ]}
              />
            ) : null}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: dur.base, ease }}>
              {tab === 'items' ? (
                <div className="space-y-4">
                  <SectionHeader
                    kicker="COLLECTION ITEMS"
                    title={`NFTs in ${collection.name}`}
                    description={`Explore featured pieces from ${collection.name}. Prices and activity shown here are illustrative demo data.`}
                  />
                  <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4">
                    {items.map((nft) => (
                      <ItemCard key={nft.id} nft={nft} symbol={collection.floorSymbol} />
                    ))}
                  </div>
                </div>
              ) : null}

              {tab === 'activity' ? (
                <div className="nx-surface overflow-hidden rounded-xl">
                  <div className="flex items-center justify-between border-b border-line/80 px-4 py-3">
                    <div>
                      <p className="text-[13px] font-medium">Last sale per item</p>
                      <p className="text-[11px] text-mute">Mock sale prices from the demo record, in {collection.floorSymbol}.</p>
                    </div>
                  </div>
                  {[...collection.nfts].sort((a, b) => b.lastSale - a.lastSale).map((nft) => {
                    const vsFloor = collection.floor ? ((nft.lastSale - collection.floor) / collection.floor) * 100 : 0
                    return (
                      <Link key={nft.id} to={`/assets/${nft.id}`} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line/70 px-4 py-2.5 transition-colors last:border-0 hover:bg-inset/50 sm:grid-cols-[auto_minmax(0,1fr)_minmax(120px,0.8fr)_auto]">
                        <ArtworkFrame src={nft.image} alt={nft.name} fallbackLabel={nft.tokenId} shade="none" parallax={false} sheen={false} className="size-10 rounded-lg" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">{nft.name}</p>
                          <p className="text-[11px] text-mute">Sale · #{nft.tokenId}</p>
                        </div>
                        <div className="hidden sm:block" aria-hidden>
                          <div className="h-1.5 overflow-hidden rounded-full bg-inset">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-copper/70 to-sage/80"
                              initial={{ width: reduced ? `${(nft.lastSale / maxSale) * 100}%` : 0 }}
                              animate={{ width: `${(nft.lastSale / maxSale) * 100}%` }}
                              transition={{ duration: 0.7, ease }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-[12.5px] tabular-nums">{nft.lastSale} {collection.floorSymbol}</p>
                          <p className={cn('font-mono text-[10.5px] tabular-nums', vsFloor >= 0 ? 'text-gain' : 'text-loss')}>{vsFloor >= 0 ? '+' : ''}{vsFloor.toFixed(0)}% vs floor</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : null}

              {tab === 'about' ? (
                <div className="nx-surface space-y-4 rounded-xl p-5">
                  <p className="max-w-2xl text-[13.5px] leading-7 text-ink/85">{collection.description}</p>
                  {collection.supplyDescription ? <p className="max-w-2xl text-[12px] leading-5 text-mute">{collection.supplyDescription}</p> : null}
                  {collection.marketContext ? <p className="max-w-2xl text-[11px] leading-5 text-mute/75">{collection.marketContext}</p> : null}
                  {collection.tags?.length ? <div className="flex flex-wrap gap-1.5">{collection.tags.map((tag) => <span key={tag} className="rounded-full border border-line px-2.5 py-1 text-[10px] capitalize text-mute">{tag.replace(/-/g, ' ')}</span>)}</div> : null}
                  <dl className="grid gap-px overflow-hidden rounded-lg border border-line/80 bg-line/60 sm:grid-cols-3">
                    {[
                      ['Lowest last sale', Math.min(...sales)],
                      ['Average last sale', avgSale],
                      ['Highest last sale', Math.max(...sales)],
                    ].map(([label, value]) => (
                      <div key={label as string} className="bg-raised px-3.5 py-3">
                        <dt className="nx-eyebrow text-[9.5px]">{label}</dt>
                        <dd className="mt-1.5 font-mono text-[15px] tabular-nums">{(value as number).toFixed(2)} {collection.floorSymbol}</dd>
                        <p className="mt-1 text-[10.5px] text-mute">sample of {sales.length} items</p>
                      </div>
                    ))}
                  </dl>
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
                  <dt className="text-[12px] text-mute">{label}</dt>
                  <dd className="min-w-0 truncate text-right text-[12.5px]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {linked ? (
            <Link to={`/tokens/${linked.id}`} className="group nx-panel block rounded-xl p-4 transition-colors hover:border-copper/35">
              <div className="mb-3 flex items-center justify-between">
                <p className="nx-eyebrow">Linked demo token</p>
                <ArrowUpRight className="size-3.5 text-mute transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
              </div>
              <div className="flex items-center gap-3">
                <TokenGlyph token={linked} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{linked.name}</p>
                  <p className="text-[11px] text-mute">{linked.ticker}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[12.5px] tabular-nums">{formatUsd(linked.price)}</p>
                  <ChangeValue value={linked.change24h} />
                </div>
              </div>
              <Sparkline data={linked.sparkline} positive={linked.change24h >= 0} className="mt-3 h-10 w-full" />
            </Link>
          ) : null}
        </aside>
      </div>

      <Reveal>
        <SectionHeader kicker="Insights" title="Collection insights" />
        <CollectionInsights collection={collection} />
      </Reveal>

      <Reveal>
        <SectionHeader kicker="RELATED COLLECTIONS" title="Similar collections" description={`Discover more collections related by category or network.`} href="/collections" />
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {related.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      </Reveal>
    </div>
  )
}
