import { ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { SectionHeader } from '@/components/shared/section-header'
import { artworkFallbackFor, catalog } from '@/data/catalog'
import { categories } from '@/data/selectors'
import { formatCompact } from '@/lib/format'
import { rise, stagger } from '@/lib/motion'
import { categoryCopy } from './discover-curation'

/** Bento slots by catalog order; the first (largest) category gets the tall tile. */
const SLOTS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

/**
 * Browse by category: an artwork-led bento mosaic that deep-links into the
 * Collections directory via `?category=`.
 */
export function CategoryMosaic() {
  const tiles = useMemo(
    () =>
      categories
        .map((category) => {
          const list = catalog.collections.filter((c) => c.category === category).sort((a, b) => b.volume24h - a.volume24h)
          // Fill the collage from covers first, then from the lead collection's pieces.
          const art = [
            ...list.map((c) => ({ key: c.id, src: c.cover, fallback: artworkFallbackFor(c.id) })),
            ...(list[0]?.nfts ?? []).map((n) => ({ key: n.id, src: n.image, fallback: undefined as string | undefined })),
          ].slice(0, 3)
          return {
            category,
            list,
            art,
            items: list.reduce((sum, c) => sum + c.items, 0),
            chains: new Set(list.map((c) => c.networkId)).size,
          }
        })
        // Largest categories take the largest tiles.
        .sort((a, b) => b.list.length - a.list.length || b.items - a.items),
    [],
  )

  return (
    <motion.section
      className="nx-dx nx-dx-cats"
      variants={stagger(0.05)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.05 }}
      aria-label="Browse by category"
    >
      <motion.div variants={rise}>
        <SectionHeader kicker="Themes" title="Browse by category" description="Jump straight into a slice of the catalog." href="/collections" />
      </motion.div>

      <ul className="nx-dx-cats__grid">
        {tiles.map(({ category, list, art, items, chains }, i) => {
          const copy = categoryCopy[category]
          return (
            <motion.li key={category} variants={rise} className={`nx-dx-cat nx-dx-cat--${SLOTS[i] ?? 'f'}`}>
              <Link to={`/collections?category=${category}`} className="nx-dx-cat__link group" aria-label={`${copy.title}: ${list.length} ${list.length === 1 ? 'collection' : 'collections'}`}>
                <span className="nx-dx-cat__collage" aria-hidden>
                  {art.map((piece, n) => (
                    <span key={piece.key} className={`nx-dx-cat__piece nx-dx-cat__piece--${n + 1}`}>
                      <ArtworkFrame src={piece.src} fallbackSrc={piece.fallback} alt="" fallbackLabel="" shade="none" parallax={false} sheen={false} className="absolute inset-0" />
                    </span>
                  ))}
                </span>
                <span aria-hidden className="nx-dx-cat__scrim" />
                <span className="nx-dx-cat__body">
                  <span className="nx-dx-cat__title">{copy.title}</span>
                  <span className="nx-dx-cat__blurb">{copy.blurb}</span>
                  <span className="nx-dx-cat__meta">
                    {list.length} {list.length === 1 ? 'collection' : 'collections'} · {formatCompact(items)} items · {chains} {chains === 1 ? 'chain' : 'chains'}
                  </span>
                </span>
                <ArrowUpRight aria-hidden className="nx-dx-cat__arrow" />
              </Link>
            </motion.li>
          )
        })}
      </ul>
    </motion.section>
  )
}
