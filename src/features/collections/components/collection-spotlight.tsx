import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Flame } from 'lucide-react'
import { NetworkChip } from '@/components/shared/network-chip'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import { Byline, CollectionArt, CollectionLink } from '@/features/collections/components/collection-parts'
import { fmtCount, fmtFloor, fmtVolume, NO_VALUE } from '@/lib/nft-data/format'
import type { ListedCollection } from '@/lib/nft-data/types'
import { dur, ease } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Editorial top of the Collections page: one large spotlight (switchable among
 * the leading collections by 24h volume) beside a ranked "Trending" column.
 * Both lists are derived from the full catalogue, not from the active filters.
 */
export function CollectionSpotlight({ ranked }: { ranked: ListedCollection[] }) {
  const picks = ranked.slice(0, 4)
  const [activeId, setActiveId] = useState(picks[0]?.id)
  const featured = picks.find((c) => c.id === activeId) ?? picks[0]
  if (!featured) return null
  const rank = ranked.findIndex((c) => c.id === featured.id) + 1
  const trending = ranked.slice(0, 6)

  return (
    <section className="nxc-spotlight" aria-label="Featured and trending collections">
      <div className="nxc-hero">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={featured.id}
            className="nxc-hero__stage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.base, ease }}
          >
            <CollectionArt src={featured.banner ?? featured.cover} alt="" fallbackLabel={featured.name} shade="none" parallax={false} sheen={false} className="nxc-hero__art" />
            <div aria-hidden className="nxc-hero__scrim" />
            <div className="nxc-hero__body">
              <div className="nxc-hero__tags">
                <span className="nxc-badge"><Flame className="size-3" /> Spotlight · #{rank} by 24h volume</span>
                <NetworkChip id={featured.networkId} className="nx-artwork-network-chip" />
              </div>
              <h2 className="nxc-hero__title">{featured.name}</h2>
              <p className="nxc-hero__by"><Byline collection={featured} /></p>
              {featured.description ? <p className="nxc-hero__desc">{featured.description}</p> : null}
              <dl className="nxc-hero__stats">
                <div><dt>Floor</dt><dd>{fmtFloor(featured.floor)}</dd></div>
                <div><dt>24h volume</dt><dd>{fmtVolume(featured.volume24h)}</dd></div>
                <div><dt>Items</dt><dd>{fmtCount(featured.items)}</dd></div>
                <div><dt>Owners</dt><dd>{fmtCount(featured.owners)}</dd></div>
              </dl>
              <div className="nxc-hero__cta">
                <CollectionLink collection={featured} className="nxc-cta">
                  View collection <ArrowUpRight className="size-4" />
                </CollectionLink>
                {featured.source === 'demo' ? <WatchlistButton kind="collection" id={featured.id} /> : null}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="nxc-hero__picker" role="group" aria-label="Choose spotlight collection">
          {picks.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === featured.id}
              aria-label={`Spotlight ${c.name}`}
              onClick={() => setActiveId(c.id)}
              className={cn('nxc-picker', c.id === featured.id && 'is-active')}
            >
              <CollectionArt src={c.cover} alt="" fallbackLabel={c.name.slice(0, 2)} shade="none" parallax={false} sheen={false} className="size-full" />
            </button>
          ))}
        </div>
      </div>

      <aside className="nxc-trending" aria-labelledby="nxc-trending-title">
        <header className="nxc-trending__head">
          <h2 id="nxc-trending-title" className="nxc-trending__title">Trending</h2>
          <span className="nx-eyebrow">24h volume</span>
        </header>
        <ol className="nxc-trending__list">
          {trending.map((c, index) => (
            <li key={c.id}>
              <CollectionLink collection={c} className="nxc-trend">
                <span className="nxc-trend__rank">{index + 1}</span>
                <CollectionArt src={c.cover} alt="" fallbackLabel={c.name.slice(0, 2)} shade="none" parallax={false} sheen={false} className="nxc-trend__thumb" />
                <span className="nxc-trend__name">
                  <b>{c.name}</b>
                  <small>Floor {fmtFloor(c.floor)}</small>
                </span>
                <span className="nxc-trend__vol">{c.volume24h ? fmtVolume(c.volume24h) : NO_VALUE}</span>
              </CollectionLink>
            </li>
          ))}
        </ol>
      </aside>
    </section>
  )
}
