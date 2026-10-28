import { BadgeCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { MediaImage } from '@/components/shared/media-image'
import { NetworkChip } from '@/components/shared/network-chip'
import { TiltSurface } from '@/components/shared/tilt-surface'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import type { Collection } from '@/data/types'
import { artworkFallbackFor } from '@/data/catalog'
import { formatCompact, formatFloor } from '@/lib/format'
import { dur, ease } from '@/lib/motion'
import { useWatchlistStore } from '@/store/watchlist-store'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'feature'

/**
 * Collection card.
 *  - default: artwork on top, identity + floor, compact stats and an item preview stack.
 *  - feature: artwork fills the card with overlaid stats; leans toward the pointer
 *    (TiltSurface) — use for a single lead item.
 * States: rest → hover (lift, artwork zoom, second piece fades in, light sweep) →
 * saved (violet edge + marker, driven by the existing watchlist store).
 * `rank` renders an ordinal chip.
 */
export function CollectionCard({
  collection,
  variant = 'default',
  rank,
  showWatchlist = true,
}: {
  collection: Collection
  variant?: Variant
  rank?: number
  /** Hide save controls and saved-state decoration in curated discovery rails. */
  showWatchlist?: boolean
}) {
  const feature = variant === 'feature'
  const rankLabel = rank ? String(rank).padStart(2, '0') : null
  const isSaved = useWatchlistStore((s) => s.collectionIds.includes(collection.id))
  const saved = showWatchlist && isSaved

  // Keep the collection cover stable on hover. NFT previews remain separate thumbnails.
  const preview = collection.nfts.slice(0, 3)

  const surface = cn(
    'nx-data-card group relative block overflow-hidden rounded-xl border bg-gradient-to-br from-[#121727] to-[#0b0f1a]',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_28px_-14px_rgba(0,0,0,0.7)]',
    'transition-[border-color,box-shadow] duration-300 ease-[var(--ease-nx)]',
    'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_48px_-22px_rgba(0,0,0,0.85),0_18px_44px_-26px_rgba(92,68,224,0.55)]',
    'focus-visible:outline-2 focus-visible:outline-copper',
    saved ? 'border-copper/40 hover:border-copper/60' : 'border-line hover:border-copper/35',
    feature && 'h-full min-h-[300px]',
  )

  const savedEdge = (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-copper to-transparent transition-opacity duration-300',
        saved ? 'opacity-100' : 'opacity-0',
      )}
    />
  )

  const card = feature ? (
    <Link to={`/collections/${collection.slug}`} className={surface} aria-label={`${collection.name}${saved ? ' (saved)' : ''}`}>
      {savedEdge}
      <ArtworkFrame src={collection.cover} fallbackSrc={artworkFallbackFor(collection.id)} alt={collection.name} fallbackLabel={collection.name.slice(0, 2)} shade="strong" className="absolute inset-0" />
      <div className="absolute left-3.5 top-3.5 flex items-center gap-2">
        {rankLabel ? <span className="nx-artwork-label rounded-md border border-white/10 bg-canvas/60 px-1.5 py-0.5 font-mono text-[10px] text-ink backdrop-blur">{rankLabel}</span> : null}
        <NetworkChip id={collection.networkId} />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 md:p-5">
        <div className="min-w-0">
          <p className="nx-eyebrow text-copper">{collection.category}</p>
          <h3 className="mt-1 truncate font-display text-[24px] font-semibold leading-tight tracking-tight md:text-[28px]">{collection.name}</h3>
          <p className="mt-0.5 truncate text-[12px] text-mute">
            {collection.creator} · {formatCompact(collection.items)} items · {formatCompact(collection.owners)} owners
          </p>
          <div className="mt-4 grid max-w-xs grid-cols-2 gap-4 border-t border-white/10 pt-3">
            <Stat label="Floor" value={formatFloor(collection.floor, collection.floorSymbol)} />
            <Stat label="24h volume" value={formatCompact(collection.volume24h)} />
          </div>
        </div>
        {preview.length ? (
          <div className="hidden shrink-0 -space-x-3 sm:flex" aria-hidden>
            {preview.map((nft, i) => (
              <span
                key={nft.id}
                className="size-12 overflow-hidden rounded-lg border-2 border-canvas shadow-lg transition-transform duration-300 ease-[var(--ease-nx)] group-hover:translate-x-0"
                style={{ transform: `translateY(${i % 2 ? 0 : -4}px) rotate(${(i - 1) * 3}deg)` }}
              >
                <MediaImage src={nft.image} alt="" fallbackLabel="" />
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  ) : (
    <Link
      to={`/collections/${collection.slug}`}
      className={cn(surface, 'aspect-[3/2]')}
      aria-label={`${collection.name}${saved ? ' (saved)' : ''}`}
    >
      {savedEdge}
      <ArtworkFrame
        src={collection.cover}
        fallbackSrc={artworkFallbackFor(collection.id)}
        alt={collection.name}
        fallbackLabel={collection.name.slice(0, 2)}
        shade="none"
        className="absolute inset-0 h-full w-full"
      >
        {/* A full-bleed, bottom-weighted scrim keeps the artwork vivid while
            making the title and floor price readable, like a modern marketplace tile. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090b12]/95 via-[#090b12]/35 via-35% to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="min-w-0 truncate text-[15px] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-base">
              {collection.name}
            </h3>
            {collection.verificationStatus === 'verified' ? (
              <BadgeCheck className="size-4 shrink-0 fill-sky-400 text-sky-400" aria-label="Verified collection" />
            ) : null}
            {saved ? <span className="size-1.5 shrink-0 rounded-full bg-copper" aria-label="Saved to watchlist" /> : null}
          </div>
          <p className="mt-1.5 flex min-w-0 items-baseline gap-1.5 text-[12px] leading-tight text-white/70 sm:text-[13px]">
            <span className="shrink-0">Floor price:</span>
            <span className="truncate font-semibold tabular-nums text-white">
              {formatFloor(collection.floor, collection.floorSymbol)}
            </span>
          </p>
        </div>
      </ArtworkFrame>
    </Link>
  )

  return (
    <motion.article
      whileHover={feature ? undefined : { y: -4 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: dur.base, ease }}
      className={cn('relative min-w-0', feature && 'h-full')}
    >
      {feature ? (
        <TiltSurface className="h-full rounded-xl" max={3}>
          {card}
          {showWatchlist ? <div className="absolute right-3 top-3 z-30"><WatchlistButton kind="collection" id={collection.id} compact /></div> : null}
        </TiltSurface>
      ) : (
        <>
          {card}
          {showWatchlist ? <div className="absolute right-2.5 top-2.5 z-10"><WatchlistButton kind="collection" id={collection.id} compact /></div> : null}
        </>
      )}
    </motion.article>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="nx-eyebrow text-[9.5px] tracking-[0.14em]">{label}</p>
      <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink">{value}</p>
    </div>
  )
}
