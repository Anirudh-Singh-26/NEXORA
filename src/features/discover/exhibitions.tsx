import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { NetworkChip } from '@/components/shared/network-chip'
import { SectionHeader } from '@/components/shared/section-header'
import { artworkFallbackFor, collectionById } from '@/data/catalog'
import type { Collection } from '@/data/types'
import { formatCompact, formatFloor } from '@/lib/format'
import { ease, rise, stagger } from '@/lib/motion'
import { DxTabList } from './dx-tabs'
import { dxPanelId, dxTabId } from './dx-tabs-ids'
import { exhibitions } from './discover-curation'

const PREFIX = 'nx-exhibition'
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']

/**
 * Featured exhibitions: a gallery-wall composition with switchable curated rooms.
 * Distinct from Curator's Pick: it is themed, multi-collection and artwork-first.
 */
export function FeaturedExhibitions() {
  const rooms = useMemo(
    () =>
      exhibitions
        .map((exhibition) => {
          const lead = collectionById[exhibition.leadId]
          if (!lead) return null
          const support = exhibition.supportIds.map((id) => collectionById[id]).filter((c): c is Collection => Boolean(c))
          return { exhibition, lead, support }
        })
        .filter((room): room is NonNullable<typeof room> => Boolean(room)),
    [],
  )
  const [activeId, setActiveId] = useState(rooms[0]?.exhibition.id ?? '')
  const index = Math.max(0, rooms.findIndex((room) => room.exhibition.id === activeId))
  const room = rooms[index]
  if (!room) return null

  const { exhibition, lead, support } = room
  const pieces = lead.nfts.slice(0, 3)

  return (
    <motion.section
      className="nx-dx nx-dx-exhibit"
      variants={stagger(0.05)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.08 }}
      aria-label="Featured exhibitions"
    >
      <motion.div variants={rise}>
        <SectionHeader kicker="Exhibitions" title="Now showing" description="Four curated rooms drawn from across the catalog." />
        <DxTabList
          label="Exhibition rooms"
          prefix={PREFIX}
          value={exhibition.id}
          onChange={setActiveId}
          className="nx-dx-exhibit__tabs"
          tabs={rooms.map((r, i) => ({
            value: r.exhibition.id,
            label: (
              <>
                <span className="nx-dx-exhibit__num">{ROMAN[i]}</span>
                <span>{r.exhibition.room}</span>
              </>
            ),
          }))}
        />
      </motion.div>

      <motion.div variants={rise}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={exhibition.id}
            id={dxPanelId(PREFIX)}
            role="tabpanel"
            aria-labelledby={dxTabId(PREFIX, exhibition.id)}
            className="nx-dx-exhibit__room"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            {/* Lead artwork with a museum-style wall label */}
            <div className="nx-dx-exhibit__lead">
              <Link to={`/collections/${lead.slug}`} className="nx-dx-exhibit__lead-art group" aria-label={`${lead.name}, lead collection of ${exhibition.title}`}>
                <ArtworkFrame
                  src={lead.banner}
                  fallbackSrc={artworkFallbackFor(lead.id)}
                  alt=""
                  fallbackLabel={lead.name.slice(0, 2)}
                  shade="none"
                  className="absolute inset-0"
                />
                <span aria-hidden className="nx-dx-exhibit__lead-scrim" />
                <span className="nx-dx-exhibit__room-tag">Room {ROMAN[index]}</span>
              </Link>

              <div className="nx-dx-exhibit__label">
                <p className="nx-kicker">{lead.category}</p>
                <h3 className="nx-dx-exhibit__title">{exhibition.title}</h3>
                <p className="nx-dx-exhibit__statement">{exhibition.statement}</p>
                <dl className="nx-dx-exhibit__facts">
                  <div><dt>Lead</dt><dd>{lead.name}</dd></div>
                  <div><dt>Creator</dt><dd>{lead.creator}</dd></div>
                  <div><dt>Items</dt><dd className="font-mono">{formatCompact(lead.items)}</dd></div>
                  <div><dt>Floor</dt><dd className="font-mono">{formatFloor(lead.floor, lead.floorSymbol)}</dd></div>
                </dl>
                <div className="nx-dx-exhibit__label-foot">
                  <NetworkChip id={lead.networkId} />
                  <Link to={`/collections/${lead.slug}`} className="nx-dx-link group">
                    Enter the collection
                    <ArrowRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Gallery wall: pieces hung at different proportions, then the rest of the room */}
            <div className="nx-dx-exhibit__wall">
              <ul className="nx-dx-exhibit__pieces" aria-label={`Works from ${lead.name}`}>
                {pieces.map((nft, i) => (
                  <li key={nft.id} className={`nx-dx-exhibit__piece nx-dx-exhibit__piece--${i + 1}`}>
                    <Link to={`/assets/${nft.id}`} className="group nx-dx-exhibit__piece-link">
                      <ArtworkFrame
                        src={nft.image}
                        alt={nft.imageAlt ?? nft.name}
                        fallbackLabel={nft.tokenId}
                        shade="none"
                        parallax={false}
                        className="nx-dx-exhibit__piece-art"
                      />
                      <span className="nx-dx-exhibit__plaque">
                        <span className="truncate">{nft.name}</span>
                        <span className="font-mono">{nft.lastSale} {lead.floorSymbol}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="nx-dx-exhibit__also">
                <p className="nx-eyebrow">Also in this room</p>
                <ul>
                  {support.map((collection) => (
                    <li key={collection.id}>
                      <Link to={`/collections/${collection.slug}`} className="nx-dx-exhibit__row group">
                        <span className="nx-dx-exhibit__thumb">
                          <ArtworkFrame src={collection.cover} fallbackSrc={artworkFallbackFor(collection.id)} alt="" fallbackLabel="" shade="none" parallax={false} sheen={false} className="absolute inset-0" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="nx-dx-exhibit__row-name">{collection.name}</span>
                          <span className="nx-dx-exhibit__row-meta">{collection.creator} · {collection.category}</span>
                        </span>
                        <NetworkChip id={collection.networkId} className="hidden sm:inline-flex" />
                        <ArrowUpRight aria-hidden className="size-3.5 shrink-0 text-mute transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:text-ink" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.section>
  )
}
