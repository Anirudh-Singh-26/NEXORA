import { ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { SectionHeader } from '@/components/shared/section-header'
import { artworkFallbackFor } from '@/data/catalog'
import { formatCompact } from '@/lib/format'
import { rise, stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { creatorKindLabel, featuredCreators } from './discover-curation'

/**
 * Studios & creators, derived from the catalog's creator profiles. There is no
 * profile route, so each card links to the creator's lead collection.
 */
export function CreatorStudios() {
  const creators = useMemo(() => featuredCreators(7), [])
  if (!creators.length) return null

  return (
    <motion.section
      className="nx-dx nx-dx-creators"
      variants={stagger(0.05)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.05 }}
      aria-label="Studios and creators"
    >
      <motion.div variants={rise}>
        <SectionHeader kicker="Studios" title="Meet the makers" description="Studios and communities behind the collections. Counts come from the demo catalog." />
      </motion.div>

      <ul className="nx-dx-creators__grid">
        {creators.map(({ profile, collections, items, holders, networks }, i) => {
          const lead = collections[0]
          const feature = i === 0
          return (
            <motion.li key={profile.id} variants={rise} className={cn('nx-dx-creator', feature && 'nx-dx-creator--feature')}>
              <Link to={`/collections/${lead.slug}`} className="nx-dx-creator__link group" aria-label={`${profile.name}: ${collections.length} ${collections.length === 1 ? 'collection' : 'collections'}. Open ${lead.name}`}>
                <span className="nx-dx-creator__backdrop" aria-hidden>
                  <ArtworkFrame src={lead.banner} fallbackSrc={artworkFallbackFor(lead.id)} alt="" fallbackLabel="" shade="none" parallax={false} sheen={false} className="absolute inset-0" />
                </span>
                <span className="nx-dx-creator__top">
                  <img src={profile.avatar} alt="" loading="lazy" decoding="async" className="nx-dx-creator__avatar" />
                  <span className="min-w-0 flex-1">
                    <span className="nx-dx-creator__name">{profile.name}</span>
                    <span className="nx-dx-creator__kind">
                      {creatorKindLabel[profile.kind] ?? 'Creator'}
                      {networks.length ? ` · ${networks.map((n) => n.shortName).join(', ')}` : ''}
                    </span>
                  </span>
                  <ArrowUpRight aria-hidden className="size-4 shrink-0 text-mute transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                </span>
                <span className="nx-dx-creator__bio">{profile.bio}</span>
                <span className="nx-dx-creator__foot">
                  <span className="nx-dx-creator__thumbs" aria-hidden>
                    {collections.slice(0, 3).map((c) => (
                      <span key={c.id} className="nx-dx-creator__thumb">
                        <ArtworkFrame src={c.cover} fallbackSrc={artworkFallbackFor(c.id)} alt="" fallbackLabel="" shade="none" parallax={false} sheen={false} className="absolute inset-0" />
                      </span>
                    ))}
                  </span>
                  <span className="nx-dx-creator__stats">
                    <span><b>{collections.length}</b> {collections.length === 1 ? 'collection' : 'collections'}</span>
                    <span><b>{formatCompact(items)}</b> items</span>
                    <span><b>{formatCompact(holders)}</b> holders</span>
                  </span>
                </span>
              </Link>
            </motion.li>
          )
        })}
      </ul>
    </motion.section>
  )
}
