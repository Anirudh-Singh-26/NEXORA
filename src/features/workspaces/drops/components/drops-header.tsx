import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { airdropOpportunities, catalog } from '@/data/catalog'
import { getCollectionById } from '@/data/selectors'
import type { Campaign } from '@/data/types'
import '@/features/workspaces/drops/drops-header.css'

type Stage = Campaign['status']

const STAGES: { value: Stage; label: string; hint: string }[] = [
  { value: 'live', label: 'Live', hint: 'Open now' },
  { value: 'upcoming', label: 'Upcoming', hint: 'Scheduled to open' },
  { value: 'ended', label: 'Ended', hint: 'Archived' },
]

function target(campaign: Campaign) {
  const collection = getCollectionById(campaign.collectionId)
  return collection ? `/collections/${collection.slug}` : '/collections'
}

/**
 * Opportunity-discovery header. A pipeline track sizes each campaign state by how
 * many catalogue campaigns sit in it, with
 * the first live and first upcoming campaign beneath it. Dates are shown exactly
 * as the catalogue states them: no countdowns, eligibility or rewards are added.
 */
export function DropsHeader() {
  const { counts, live, upcoming } = useMemo(() => {
    const all = catalog.campaigns
    return {
      counts: { live: all.filter((c) => c.status === 'live').length, upcoming: all.filter((c) => c.status === 'upcoming').length, ended: all.filter((c) => c.status === 'ended').length } satisfies Record<Stage, number>,
      live: all.find((c) => c.status === 'live'),
      upcoming: all.find((c) => c.status === 'upcoming'),
    }
  }, [])
  const total = counts.live + counts.upcoming + counts.ended

  return (
    <header className="nxd-head">
      <div className="nxd-head__copy">
        <p className="nx-kicker">Opportunity discovery</p>
        <h1 className="nxd-head__title">Drops <span>&amp;</span> airdrops</h1>
        <p className="nxd-head__deck">Find active launches, prepare for upcoming windows, and review ended campaigns without jumping between trackers. Use the catalogue below to compare opportunities by status, network, and reward type.</p>
        <p className="nxd-head__pill"><span aria-hidden /> Demo environment · sample data</p>
        <div className="nxd-head__highlights" aria-label="Discovery features">
          <div className="nxd-head__highlight"><span className="nxd-head__highlight-icon is-live" aria-hidden>●</span><span><b>Live launches</b><small>See what is open now</small></span></div>
          <div className="nxd-head__highlight"><span className="nxd-head__highlight-icon is-upcoming" aria-hidden>↗</span><span><b>Upcoming windows</b><small>Know what is next</small></span></div>
          <div className="nxd-head__highlight"><span className="nxd-head__highlight-icon is-research" aria-hidden>⌕</span><span><b>Airdrop research</b><small>Explore records in one place</small></span></div>
        </div>
      </div>

      <div className="nxd-pipe">
        <p className="nx-eyebrow nxd-pipe__title">Campaign pipeline</p>
        <div className="nxd-pipe__track" role="img" aria-label={`${counts.live} live, ${counts.upcoming} upcoming and ${counts.ended} ended campaigns in the catalogue`}>
          {STAGES.map((stage) => (
            <i key={stage.value} className={`is-${stage.value}`} style={{ flexGrow: counts[stage.value] }} hidden={counts[stage.value] === 0} />
          ))}
        </div>
        <ul className="nxd-pipe__legend">
          {STAGES.map((stage) => (
            <li key={stage.value} className={`is-${stage.value}`}>
              <span className="nxd-pipe__label">{stage.value === 'live' ? <span className="nx-live-dot" /> : <i aria-hidden />}{stage.label}</span>
              <b>{counts[stage.value]}</b>
              <small>{stage.hint}</small>
            </li>
          ))}
        </ul>
        <p className="nxd-pipe__total">{total} campaigns · {airdropOpportunities.length} airdrop research records. Use the filters below to narrow them.</p>

        <div className="nxd-pipe__picks">
          {live ? (
            <Link to={target(live)} className="nxd-pick is-live">
              <span className="nxd-pick__tag"><span className="nx-live-dot" /> Live</span>
              <b>{live.title}</b>
              <small>{live.startsAt}</small>
              <ArrowUpRight className="nxd-pick__go size-4" aria-hidden />
            </Link>
          ) : null}
          {upcoming ? (
            <Link to={target(upcoming)} className="nxd-pick is-upcoming">
              <span className="nxd-pick__tag"><i aria-hidden /> Upcoming</span>
              <b>{upcoming.title}</b>
              <small>{upcoming.startsAt}</small>
              <ArrowUpRight className="nxd-pick__go size-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  )
}
