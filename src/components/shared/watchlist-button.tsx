import { Bookmark } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { popSpring, useMotionReduced } from '@/lib/motion'
import { useWatchlistStore } from '@/store/watchlist-store'
import { cn } from '@/lib/utils'

type WatchlistButtonProps = {
  kind: 'token' | 'collection' | 'asset' | 'campaign'
  id: string
  compact?: boolean
  className?: string
}

const noun = { token: 'token', collection: 'collection', asset: 'asset', campaign: 'campaign' } as const

export function WatchlistButton({ kind, id, compact, className }: WatchlistButtonProps) {
  const reduced = useMotionReduced()
  // Subscribe only to the list this button cares about (fewer re-renders in long tables/grids).
  const active = useWatchlistStore((s) =>
    kind === 'token' ? s.tokenIds.includes(id) : kind === 'collection' ? s.collectionIds.includes(id) : kind === 'asset' ? s.assetIds.includes(id) : s.campaignIds.includes(id),
  )
  const toggleToken = useWatchlistStore((s) => s.toggleToken)
  const toggleCollection = useWatchlistStore((s) => s.toggleCollection)
  const toggleAsset = useWatchlistStore((s) => s.toggleAsset)
  const toggleCampaign = useWatchlistStore((s) => s.toggleCampaign)

  return (
    <Button
      type="button"
      variant={active ? 'copper' : 'outline'}
      size={compact ? 'icon' : 'sm'}
      className={cn('transition-[background-color,border-color,color] duration-200', className)}
      aria-pressed={active}
      aria-label={active ? `Remove ${noun[kind]} from watchlist` : `Add ${noun[kind]} to watchlist`}
      title={active ? 'Saved — click to remove' : 'Save to watchlist'}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (kind === 'token') toggleToken(id)
        else if (kind === 'collection') toggleCollection(id)
        else if (kind === 'asset') toggleAsset(id)
        else toggleCampaign(id)
      }}
    >
      {/* Keyed on state so each save/unsave replays a small spring pop (skipped under reduced motion). */}
      <motion.span
        key={active ? 'on' : 'off'}
        className="relative inline-flex"
        initial={reduced ? false : { scale: active ? 0.55 : 1, y: active ? 0 : -1 }}
        animate={{ scale: 1, y: 0 }}
        transition={popSpring}
      >
        <Bookmark className={cn('size-4 transition-colors', active && 'fill-copper')} />
        <AnimatePresence>
          {active && !reduced ? (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full border border-copper/70"
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          ) : null}
        </AnimatePresence>
      </motion.span>
      {compact ? null : <span aria-live="polite">{active ? 'Watching' : 'Watch'}</span>}
    </Button>
  )
}
