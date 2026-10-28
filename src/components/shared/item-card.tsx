import { ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import type { NftItem } from '@/data/types'
import { dur, ease } from '@/lib/motion'
import { useWatchlistStore } from '@/store/watchlist-store'
import { cn } from '@/lib/utils'

/**
 * NFT item card: square artwork, quiet caption, last sale as the one number
 * that matters. Links to the asset page; saved items get a violet edge + dot.
 */
export function ItemCard({ nft, symbol, className }: { nft: NftItem; symbol: string; className?: string }) {
  const saved = useWatchlistStore((s) => s.assetIds.includes(nft.id))

  return (
    <motion.article whileHover={{ y: -3 }} transition={{ duration: dur.base, ease }} className={cn('relative min-w-0', className)}>
      <Link
        to={`/assets/${nft.id}`}
        aria-label={`${nft.name}${saved ? ' (saved)' : ''}`}
        className={cn(
          'nx-data-card group block overflow-hidden rounded-xl border bg-gradient-to-br from-[#121727] to-[#0b0f1a]',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_28px_-14px_rgba(0,0,0,0.7)] transition-[border-color,box-shadow] duration-300 ease-[var(--ease-nx)]',
          'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_26px_44px_-22px_rgba(0,0,0,0.85),0_16px_40px_-26px_rgba(92,68,224,0.5)]',
          'focus-visible:outline-2 focus-visible:outline-copper',
          saved ? 'border-copper/40 hover:border-copper/60' : 'border-line hover:border-copper/35',
        )}
      >
        <ArtworkFrame src={nft.image} alt={nft.name} fallbackLabel={nft.tokenId} className="aspect-square">
          <span className="absolute bottom-2.5 left-2.5 nx-artwork-label rounded-md border border-white/10 bg-canvas/60 px-1.5 py-0.5 font-mono text-[10px] text-ink/90 backdrop-blur">#{nft.tokenId}</span>
        </ArtworkFrame>
        <div className="flex items-end justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium leading-tight">
              <span className="truncate">{nft.name}</span>
              {saved ? <span className="size-1.5 shrink-0 rounded-full bg-copper shadow-[0_0_6px_rgba(169,154,255,0.8)]" aria-hidden /> : null}
            </p>
            <p className="nx-eyebrow mt-1.5 text-[9px] tracking-[0.14em]">Last sale</p>
            <p className="font-mono text-[12.5px] tabular-nums">{nft.lastSale} {symbol}</p>
          </div>
          <ArrowUpRight className="mb-0.5 size-3.5 shrink-0 text-mute/50 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </Link>
      <div className="absolute right-2 top-2 z-10"><WatchlistButton kind="asset" id={nft.id} compact /></div>
    </motion.article>
  )
}
