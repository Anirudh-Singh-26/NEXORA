import { ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { TiltSurface } from '@/components/shared/tilt-surface'
import { getCollectionById } from '@/data/selectors'
import type { Campaign } from '@/data/types'
import { formatFloor } from '@/lib/format'
import { dur, ease } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Drop / campaign card: full-bleed artwork, status + timing up top, title block
 * and the linked collection's floor (from mock data) below. A call-to-action row
 * slides up on hover. Leans slightly toward the pointer.
 */
export function CampaignCard({ campaign, className, fill }: { campaign: Campaign; className?: string; /** Stretch to the grid cell height (for asymmetric layouts). */ fill?: boolean }) {
  const collection = getCollectionById(campaign.collectionId)
  const live = campaign.status === 'live'

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: dur.base, ease }} className={cn('min-w-0', fill && 'h-full', className)}>
      <TiltSurface className={cn('rounded-xl', fill && 'h-full')} max={3}>
        <Link
          to={collection ? `/collections/${collection.slug}` : '/collections'}
          className={cn('nx-campaign-card group relative block min-h-64 overflow-hidden rounded-xl border border-line bg-raised shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_28px_-14px_rgba(0,0,0,0.7)] transition-[border-color,box-shadow] duration-300 ease-[var(--ease-nx)] hover:border-copper/35 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_48px_-22px_rgba(0,0,0,0.85),0_18px_44px_-26px_rgba(92,68,224,0.5)] focus-visible:outline-2 focus-visible:outline-copper', fill && 'h-full')}
        >
          <ArtworkFrame src={campaign.cover} alt={campaign.title} fallbackLabel="DR" shade="none" className="absolute inset-0" />
          <div aria-hidden className="nx-campaign-scrim pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas via-canvas/40 to-transparent" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-3.5">
            <span
              className={cn(
                'nx-campaign-status inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] backdrop-blur',
                live ? 'border-gain/35 bg-canvas/55 text-gain' : 'border-copper/35 bg-canvas/55 text-copper',
              )}
            >
              {live ? <span className="nx-live-dot" /> : null}
              {campaign.status}
            </span>
            <span className="nx-campaign-time rounded-full border border-white/10 bg-canvas/55 px-2 py-0.5 font-mono text-[10px] text-ink/90 backdrop-blur">{campaign.startsAt}</span>
          </div>

          <div className={cn('relative flex h-full min-h-64 flex-col justify-end p-4 md:p-5', fill && 'md:p-6')}>
            <h3 className={cn('font-display text-[22px] font-semibold leading-tight tracking-tight', fill && 'md:text-[28px]')}>{campaign.title}</h3>
            <p className="nx-campaign-subtitle mt-0.5 text-[12.5px] text-mute">{campaign.subtitle}</p>
            <div className="nx-campaign-meta mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              {collection ? (
                <p className="min-w-0 truncate text-[11px] text-mute">
                  {collection.name}
                  <span className="mx-1.5 text-mute/40">·</span>
                  Floor <span className="font-mono tabular-nums text-ink/90">{formatFloor(collection.floor, collection.floorSymbol)}</span>
                </p>
              ) : (
                <span />
              )}
              <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-ink opacity-70 transition-all duration-300 ease-[var(--ease-nx)] group-hover:translate-x-0.5 group-hover:opacity-100">
                View
                <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px" />
              </span>
            </div>
          </div>
        </Link>
      </TiltSurface>
    </motion.div>
  )
}
