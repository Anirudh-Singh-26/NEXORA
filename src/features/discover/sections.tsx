import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { NetworkChip } from '@/components/shared/network-chip'
import { ChangeValue } from '@/components/shared/change-value'
import { CollectionCard } from '@/components/shared/collection-card'
import { WavyBackground } from '@/components/ui/wavy-background'
import { Segmented } from '@/components/shared/segmented'
import { SectionHeader } from '@/components/shared/section-header'
import { Sparkline } from '@/components/shared/sparkline'
import { TokenGlyph } from '@/components/shared/token-glyph'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import { Button } from '@/components/ui/button'
import { catalog } from '@/data/catalog'
import { isEmerging } from '@/features/discover/discover-curation'
import type { Collection, Token } from '@/data/types'
import { formatCompact, formatFloor, formatUsd } from '@/lib/format'
import { dur, ease, rise, stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/ui-store'


/* -------------------------------------------------------------------------- */
/* Spotlight — a cinematic curator's pick                                      */
/* -------------------------------------------------------------------------- */

/** Pick: the most widely held collection (highest owner count) in the demo set. */
export function Spotlight() {
  const pick = useMemo<Collection>(() => [...catalog.collections].sort((a, b) => b.owners - a.owners)[0], [])
  const theme = useUiStore((s) => s.theme)
  const stack = pick.nfts.slice(0, 3)

  return (
    <motion.section variants={rise} className="nx-spotlight relative isolate overflow-hidden">
      <WavyBackground
        containerClassName="nx-spotlight-wavy absolute inset-0 z-0 h-full w-full overflow-hidden"
        className="pointer-events-none h-full w-full"
        backgroundFill={theme === 'light' ? '#f7f8fc' : '#070912'}
      />
      <div className="nx-spotlight-fade-x pointer-events-none absolute inset-0 z-[1]" />
      <div className="nx-spotlight-fade-y pointer-events-none absolute inset-0 z-[1]" />

      <div className="relative z-10 grid min-h-[420px] items-center gap-8 px-3 py-9 sm:px-5 md:min-h-[460px] md:py-11 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10 lg:px-8 xl:gap-14">
        {/* Compact editorial content block, left-aligned within the right column. */}
        <div className="order-2 w-full max-w-[590px] lg:order-2 lg:justify-self-end">
          <p className="nx-kicker text-left">
            Curator&rsquo;s pick
          </p>
          <h2 className="mt-3 text-left font-display text-[clamp(2.15rem,3.6vw,3.1rem)] font-bold leading-[1.02] tracking-[-0.04em]">{pick.name}</h2>
          <p className={cn("mt-1 text-left text-[14px] font-normal", theme === 'light' ? 'text-black' : 'text-white')}>
            {pick.creator} · {pick.category}
          </p>
          <p className="mt-4 line-clamp-3 max-w-[560px] text-left text-[15px] font-medium leading-7 text-ink">{pick.description}</p>

          <dl className={cn("mt-5 grid max-w-[540px] grid-cols-3 border-t pt-4 text-left", theme === 'light' ? 'border-slate-300' : 'border-white/10')}>
            {[
              ['Floor', formatFloor(pick.floor, pick.floorSymbol)],
              ['24h vol', formatCompact(pick.volume24h)],
              ['Holders', formatCompact(pick.owners)],
            ].map(([label, value], i) => (
              <div key={label} className={i ? cn('border-l pl-3 sm:pl-4', theme === 'light' ? 'border-slate-300' : 'border-white/10') : undefined}>
                <dt className={cn("nx-eyebrow text-[10px] font-medium", theme === 'light' ? 'text-black' : 'text-white')}>{label}</dt>
                <dd className="mt-1 font-mono text-[15px] font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap items-center justify-start gap-2.5">
            <Button asChild className="nx-hero-cta nx-hero-cta--primary group/cta">
              <Link to={`/collections/${pick.slug}`}>
                <span>Check Out</span>
                <ArrowRight className="nx-hero-cta__arrow size-4" aria-hidden="true" />
              </Link>
            </Button>
            <WatchlistButton
              kind="collection"
              id={pick.id}
              className="nx-hero-cta nx-hero-cta--secondary group/cta"
            />
          </div>
        </div>

        {/* Three-card editorial fan: side cards tilt back; each card zooms independently on hover. */}
        <div className="nx-spotlight-artwork relative order-1 hidden h-[300px] w-full max-w-[500px] lg:order-1 lg:block lg:justify-self-center [perspective:1200px]" aria-label="Featured collection artwork">
          {stack.map((nft, i) => {
            const offset = i - 1
            return (
              <motion.div
                key={nft.id}
                className="absolute left-1/2 top-1/2 w-[184px] xl:w-[198px]"
                style={{
                  x: offset * 126 - 99,
                  y: '-50%',
                  rotate: offset * 9,
                  zIndex: i === 1 ? 5 : i === 0 ? 3 : 2,
                  transformOrigin: 'center center',
                }}
                whileHover={{ scale: 1.075, zIndex: 20, rotate: offset * 4 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22, mass: 0.7 }}
              >
                <Link
                  to={`/assets/${nft.id}`}
                  tabIndex={-1}
                  className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-copper"
                >
                  <ArtworkFrame
                    src={nft.image}
                    alt={nft.name}
                    fallbackLabel={nft.tokenId}
                    shade="none"
                    parallax={false}
                    className="aspect-[3/4] rounded-xl border border-white/10 shadow-[0_24px_40px_-18px_rgba(0,0,0,0.9)] transition-[border-color,box-shadow] duration-300 group-hover:border-white/25 group-hover:shadow-[0_30px_60px_-18px_rgba(0,0,0,0.95)]"
                  >
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-canvas/90 to-transparent px-2.5 pb-2 pt-6 text-[10.5px] text-ink/90">
                      {nft.name}
                      <span className="block font-mono text-[9.5px] text-mute">Last sale {nft.lastSale} {pick.floorSymbol}</span>
                    </span>
                  </ArtworkFrame>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}

/* -------------------------------------------------------------------------- */
/* Trending shelf — horizontal, snap-scrolling                                 */
/* -------------------------------------------------------------------------- */

export function TrendingShelf() {
  const rail = useRef<HTMLDivElement>(null)
  const [scrollState, setScrollState] = useState({ left: false, right: false })
  const [railActive, setRailActive] = useState(false)
  const items = useMemo(() => [...catalog.collections].sort((a, b) => b.volume24h - a.volume24h).slice(0, 8), [])

  const updateScrollState = () => {
    const node = rail.current
    if (!node) return

    // Clamp the current offset and use one consistent tolerance for both edges.
    // This prevents the left control appearing at scroll origin because of tiny
    // fractional offsets or stale state during a smooth-scroll animation.
    const maxScroll = Math.max(0, node.scrollWidth - node.clientWidth)
    const currentScroll = Math.min(maxScroll, Math.max(0, node.scrollLeft))
    const edgeTolerance = 8
    const nextState = {
      left: currentScroll > edgeTolerance,
      right: maxScroll - currentScroll > edgeTolerance,
    }

    setScrollState((previous) =>
      previous.left === nextState.left && previous.right === nextState.right
        ? previous
        : nextState,
    )
  }

  useEffect(() => {
    const node = rail.current
    if (!node) return
    updateScrollState()
    node.addEventListener('scroll', updateScrollState, { passive: true })
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(node)
    if (node.firstElementChild) observer.observe(node.firstElementChild)
    return () => {
      node.removeEventListener('scroll', updateScrollState)
      observer.disconnect()
    }
  }, [items.length])

  const scroll = (dir: 1 | -1) => {
    const node = rail.current
    if (!node) return
    node.scrollBy({ left: dir * Math.max(240, node.clientWidth * 0.8), behavior: 'smooth' })
    // Keep edge controls synchronized while the smooth scroll is progressing.
    window.requestAnimationFrame(updateScrollState)
  }

  const arrow = 'pointer-events-auto flex size-10 items-center justify-center rounded-full border border-white/[0.14] bg-[#151515]/70 text-white/80 shadow-none backdrop-blur-sm transition-[opacity,transform,border-color,color,background-color] duration-200 hover:border-white/25 hover:bg-[#202020]/85 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.97]'

  return (
    <motion.section variants={stagger(0.05)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
      <motion.div variants={rise}>
        <SectionHeader
          kicker="Now moving"
          title="Trending this hour"
          description="The eight busiest collections by 24h volume, established communities and emerging ones side by side."
          href="/collections"
        />
      </motion.div>
      <motion.div
        variants={rise}
        className="group/rail relative -mx-1 px-1"
        onMouseEnter={() => setRailActive(true)}
        onMouseLeave={() => setRailActive(false)}
        onFocusCapture={() => setRailActive(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setRailActive(false)
        }}
      >
        <button
          type="button"
          className={cn(arrow, 'absolute left-2 top-1/2 z-20 -translate-y-1/2', scrollState.left && railActive ? 'translate-x-0' : '-translate-x-1')}
          style={{
            opacity: railActive && scrollState.left ? 1 : 0,
            visibility: railActive && scrollState.left ? 'visible' : 'hidden',
            pointerEvents: railActive && scrollState.left ? 'auto' : 'none',
          }}
          onClick={() => scroll(-1)}
          aria-label="Scroll collections backward"
          aria-hidden={!scrollState.left || !railActive}
          disabled={!scrollState.left || !railActive}
          tabIndex={scrollState.left && railActive ? 0 : -1}
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          className={cn(arrow, 'absolute right-2 top-1/2 z-20 -translate-y-1/2', scrollState.right && railActive ? 'translate-x-0' : 'translate-x-1')}
          style={{
            opacity: railActive && scrollState.right ? 1 : 0,
            visibility: railActive && scrollState.right ? 'visible' : 'hidden',
            pointerEvents: railActive && scrollState.right ? 'auto' : 'none',
          }}
          onClick={() => scroll(1)}
          aria-label="Scroll collections forward"
          aria-hidden={!scrollState.right || !railActive}
          disabled={!scrollState.right || !railActive}
          tabIndex={scrollState.right && railActive ? 0 : -1}
        >
          <ChevronRight className="size-4" />
        </button>
        <div
          ref={rail}
          onScroll={updateScrollState}
          data-left={scrollState.left}
          data-right={scrollState.right}
          className="nx-nav-scroll nx-dx-shelf flex snap-x snap-mandatory gap-3.5 overflow-x-auto overscroll-x-contain px-1 pb-3 pt-1"
          tabIndex={0}
          role="region"
          aria-label="Trending collections"
        >
          {items.map((collection, index) => (
            <div key={collection.id} className="w-[250px] shrink-0 snap-start sm:w-[280px]">
              <CollectionCard collection={collection} rank={index + 1} showWatchlist={false} />
              <div className="nx-dx-trend-meta">
                <span className="nx-dx-trend-rank" aria-label={`Rank ${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
                <NetworkChip id={collection.networkId} />
                <span className="nx-dx-trend-holders">{formatCompact(collection.owners)} holders</span>
                <span className={cn('nx-dx-trend-tag', isEmerging(collection) ? 'is-emerging' : 'is-established')}>
                  {isEmerging(collection) ? 'Emerging' : 'Established'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.section>
  )
}

/* Category mosaic now lives in category-mosaic.tsx (artwork-led bento). */
export { CategoryMosaic } from '@/features/discover/category-mosaic'

/* -------------------------------------------------------------------------- */
/* Token tape — compact quote tiles with a ranking lens                        */
/* -------------------------------------------------------------------------- */

type Lens = 'movers' | 'gainers' | 'losers'
const LENSES: { value: Lens; label: string }[] = [
  { value: 'movers', label: 'Movers' },
  { value: 'gainers', label: 'Gainers' },
  { value: 'losers', label: 'Losers' },
]

function rankTokens(lens: Lens): Token[] {
  const all = [...catalog.tokens]
  if (lens === 'gainers') return all.sort((a, b) => b.change24h - a.change24h).slice(0, 6)
  if (lens === 'losers') return all.sort((a, b) => a.change24h - b.change24h).slice(0, 6)
  return all.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 6)
}

export function TokenTape() {
  const [lens, setLens] = useState<Lens>('movers')
  const rows = useMemo(() => rankTokens(lens), [lens])

  return (
    <motion.section variants={stagger(0.05)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
      <motion.div variants={rise}>
        <SectionHeader
          kicker="Quotes"
          title="Token tape"
          description="Demo quotes only. Prices are fictional or stylized."
          action={
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <Segmented label="Token ranking" options={LENSES} value={lens} onChange={setLens} />
            </div>
          }
        />
      </motion.div>
      <motion.div variants={rise}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={lens}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            variants={stagger(0.04)}
            className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
          >
            {rows.map((token) => (
              <motion.div
                key={token.id}
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: dur.base, ease } } }}
                className="nx-data-card group relative flex min-w-0 flex-col rounded-xl border border-line bg-gradient-to-br from-[#121727] to-[#0b0f1a] p-3 transition-[border-color,transform] duration-300 ease-[var(--ease-nx)] hover:-translate-y-0.5 hover:border-copper/35"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/tokens/${token.id}`} className="flex min-w-0 items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-copper">
                    <TokenGlyph token={token} className="size-8" />
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium">{token.name}</span>
                      <span className="block text-[10.5px] text-mute">{token.ticker}</span>
                    </span>
                  </Link>
                  <WatchlistButton kind="token" id={token.id} compact />
                </div>
                <Sparkline data={token.sparkline} positive={token.change24h >= 0} className="mt-3 h-10 w-full" />
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[13px] tabular-nums">{formatUsd(token.price)}</span>
                  <ChangeValue value={token.change24h} />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.section>
  )
}
