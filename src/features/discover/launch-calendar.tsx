import { ArrowRight, ArrowUpRight, CalendarDays } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { NetworkChip } from '@/components/shared/network-chip'
import { SectionHeader } from '@/components/shared/section-header'
import { artworkFallbackFor, collectionById, creatorProfiles, tokenById } from '@/data/catalog'
import type { Campaign } from '@/data/types'
import { formatCompact } from '@/lib/format'
import { ease, rise, stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { DxTabList } from './dx-tabs'
import { dxPanelId, dxTabId } from './dx-tabs-ids'
import { launchesByStatus } from './discover-curation'


type Phase = 'live' | 'upcoming' | 'recent'
const PREFIX = 'nx-launch'

const PHASE_LABEL: Record<Phase, string> = { live: 'Live', upcoming: 'Upcoming', recent: 'Recently launched' }
const STATUS_TEXT: Record<Campaign['status'], string> = { live: 'Live', upcoming: 'Upcoming', ended: 'Closed' }

/** Strip the "· demo schedule" suffix for compact display; the section footnote states it once. */
const when = (campaign: Campaign) => campaign.startsAt.replace(/\s*·\s*demo (schedule|campaign)/i, '').trim()

/**
 * Launch calendar inspired by marketplace drop pages: one featured launch plus a
 * compact queue. Status and timing come from demo schedule labels, never live clocks.
 */
export function LaunchCalendar() {
  const [phase, setPhase] = useState<Phase>('live')
  const list = launchesByStatus[phase]
  const [selectedId, setSelectedId] = useState(list[0]?.id)

  const featured = useMemo(() => list.find((c) => c.id === selectedId) ?? list[0], [list, selectedId])
  const queue = list.filter((c) => c.id !== featured?.id)

  return (
    <motion.section
      className="nx-dx nx-dx-launch"
      variants={stagger(0.05)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.08 }}
      aria-label="Launch calendar"
    >
      <motion.div variants={rise}>
        <SectionHeader
          kicker="Drops"
          title="Launch calendar"
          description="Live, upcoming and recently closed launches. Schedules are demo labels, not real mints."
          action={
            <Link to="/drops" className="nx-dx-link group">
              <CalendarDays aria-hidden className="size-3.5" />
              Full drops calendar
              <ArrowUpRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5" />
            </Link>
          }
        />
        <DxTabList
          label="Launch status"
          prefix={PREFIX}
          value={phase}
          onChange={(nextPhase) => {
            setPhase(nextPhase)
            setSelectedId(launchesByStatus[nextPhase][0]?.id)
          }}
          className="nx-dx-launch__tabs"
          tabs={(Object.keys(PHASE_LABEL) as Phase[]).map((p) => ({
            value: p,
            label: (
              <>
                {p === 'live' ? <span aria-hidden className="nx-dx-live-dot" /> : null}
                {PHASE_LABEL[p]}
                <span className="nx-dx-count">{launchesByStatus[p].length}</span>
              </>
            ),
          }))}
        />
      </motion.div>

      <motion.div variants={rise}>
        <div id={dxPanelId(PREFIX)} role="tabpanel" aria-labelledby={dxTabId(PREFIX, phase)} className="nx-dx-launch__body">
          {featured ? <FeaturedLaunch campaign={featured} /> : <p className="nx-dx-empty">Nothing scheduled in this view.</p>}

          <div className="nx-dx-launch__panel">
            <p className="nx-dx-launch__panel-head"><span className="nx-eyebrow">{phase === 'recent' ? 'Also closed' : 'Up next'}</span><span className="nx-dx-count">{queue.length}</span></p>
            <ul className="nx-dx-launch__queue" aria-label={`${PHASE_LABEL[phase]} launches`}>
              {queue.length === 0 ? (
                <li className="nx-dx-empty">That is the only launch in this view.</li>
              ) : (
                queue.map((campaign) => {
                  const collection = collectionById[campaign.collectionId]
                  return (
                    <li key={campaign.id}>
                      <button type="button" className="nx-dx-launch__row group" onClick={() => setSelectedId(campaign.id)} aria-label={`Feature ${campaign.title} from ${collection?.name ?? campaign.subtitle}`}>
                        <span className="nx-dx-launch__thumb">
                          <ArtworkFrame src={campaign.cover} fallbackSrc={collection ? artworkFallbackFor(collection.id) : undefined} alt="" fallbackLabel="" shade="none" parallax={false} sheen={false} className="absolute inset-0" />
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="nx-dx-launch__row-title">{campaign.title}</span>
                          <span className="nx-dx-launch__row-sub">{campaign.subtitle}</span>
                        </span>
                        <span className="nx-dx-launch__row-side">
                          {campaign.networkId ? <NetworkChip id={campaign.networkId} /> : null}
                          <span className={cn('nx-dx-launch__when', campaign.status === 'live' && 'is-live')}>{when(campaign)}</span>
                        </span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.section>
  )
}

function FeaturedLaunch({ campaign }: { campaign: Campaign }) {
  const collection = collectionById[campaign.collectionId]
  const creator = creatorProfiles.find((c) => c.id === campaign.creatorId)
  const currency = campaign.mintCurrencyTokenId ? tokenById[campaign.mintCurrencyTokenId]?.ticker : undefined

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.article
        key={campaign.id}
        className="nx-dx-launch__feature"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease } }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
      >
        <div className="nx-dx-launch__feature-art">
          <ArtworkFrame src={campaign.cover} fallbackSrc={collection ? artworkFallbackFor(collection.id) : undefined} alt="" fallbackLabel="" shade="none" parallax={false} sheen={false} className="absolute inset-0" />
          <span aria-hidden className="nx-dx-launch__feature-scrim" />
        </div>
        <div className="nx-dx-launch__feature-copy">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('nx-dx-status', `nx-dx-status--${campaign.status}`)}>
              {campaign.status === 'live' ? <span aria-hidden className="nx-dx-live-dot" /> : null}
              {STATUS_TEXT[campaign.status]}
            </span>
            {campaign.networkId ? <NetworkChip id={campaign.networkId} className="nx-dx-chip-on-art" /> : null}
          </div>
          <h3 className="nx-dx-launch__feature-title">{campaign.title}</h3>
          <p className="nx-dx-launch__feature-sub">{campaign.subtitle}</p>

          <div className="nx-dx-launch__creator">
            {creator ? <img src={creator.avatar} alt="" loading="lazy" decoding="async" className="nx-dx-avatar" /> : null}
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-medium">{creator?.name ?? collection?.creator}</span>
              <span className="block truncate text-[11px] opacity-70">{collection?.name}</span>
            </span>
          </div>

          <dl className="nx-dx-launch__facts">
            <div><dt>Schedule</dt><dd>{when(campaign)}</dd></div>
            {campaign.supply ? <div><dt>Supply</dt><dd className="font-mono">{formatCompact(campaign.supply)}</dd></div> : null}
            {campaign.mintPrice && currency ? <div><dt>Mint price</dt><dd className="font-mono">{campaign.mintPrice} {currency}</dd></div> : null}
          </dl>

          {collection ? (
            <Link to={`/collections/${collection.slug}`} className="nx-dx-cta group">
              View collection
              <ArrowRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          ) : null}
        </div>
      </motion.article>
    </AnimatePresence>
  )
}
