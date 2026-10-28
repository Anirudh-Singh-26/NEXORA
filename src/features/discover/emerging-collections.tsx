import { ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { NetworkChip } from '@/components/shared/network-chip'
import { SectionHeader } from '@/components/shared/section-header'
import { artworkFallbackFor } from '@/data/catalog'
import { formatCompact, formatFloor } from '@/lib/format'
import { rise, stagger } from '@/lib/motion'
import { emergingCollections } from './discover-curation'

const SLOTS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

/**
 * Hidden gems: a staggered artwork grid of collections with the smallest holder
 * bases in the demo catalog. A discovery lens, never a recommendation.
 */
export function EmergingCollections() {
  const items = useMemo(() => emergingCollections(SLOTS.length), [])

  return (
    <motion.section
      className="nx-dx nx-dx-gems"
      variants={stagger(0.06)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.05 }}
      aria-label="Emerging collections"
    >
      <motion.div variants={rise}>
        <SectionHeader
          kicker="Emerging"
          title="Small rooms, big artwork"
          description="Collections with the smallest holder communities in the demo catalog. A way to explore, not a signal of value."
          href="/collections"
        />
      </motion.div>

      <ul className="nx-dx-gems__grid">
        {items.map((collection, i) => {
          const slot = SLOTS[i]
          const compact = slot === 'e' || slot === 'f'
          return (
            <motion.li key={collection.id} variants={rise} className={`nx-dx-gem nx-dx-gem--${slot}`}>
              <Link to={`/collections/${collection.slug}`} className="nx-dx-gem__link group" aria-label={`${collection.name} by ${collection.creator}, ${formatCompact(collection.owners)} holders`}>
                <ArtworkFrame
                  src={slot === 'b' || slot === 'c' ? collection.banner : collection.cover}
                  fallbackSrc={artworkFallbackFor(collection.id)}
                  alt=""
                  fallbackLabel={collection.name.slice(0, 2)}
                  shade="none"
                  className="absolute inset-0"
                />
                <span aria-hidden className="nx-dx-gem__scrim" />
                <NetworkChip id={collection.networkId} className="nx-dx-gem__chain nx-dx-chip-on-art" />
                <span className="nx-dx-gem__body">
                  <span className="nx-dx-gem__name">{collection.name}</span>
                  {compact ? null : <span className="nx-dx-gem__creator">{collection.creator} · {collection.category}</span>}
                  <span className="nx-dx-gem__stats">
                    <span><b>{formatCompact(collection.owners)}</b> holders</span>
                    <span><b>{formatCompact(collection.items)}</b> items</span>
                    {compact ? null : <span>Floor <b>{formatFloor(collection.floor, collection.floorSymbol)}</b></span>}
                  </span>
                </span>
                <ArrowUpRight aria-hidden className="nx-dx-gem__arrow" />
              </Link>
            </motion.li>
          )
        })}
      </ul>
    </motion.section>
  )
}
