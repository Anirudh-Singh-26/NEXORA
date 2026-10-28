import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import { getCollectionById } from '@/data/selectors'
import type { Campaign } from '@/data/types'
import { CampaignFacts } from '@/features/workspaces/drops/components/campaign-facts'

/**
 * Upcoming campaigns on a vertical spine. The schedule text is shown exactly as
 * the catalogue states it; no countdown or date is derived from it.
 */
export function LaunchTimeline({ upcoming }: { upcoming: Campaign[] }) {
  if (upcoming.length === 0) return null
  return (
    <section className="nxd-section" aria-labelledby="nxd-up-title">
      <header className="nxd-section__head">
        <i className="nxd-dot is-upcoming" aria-hidden />
        <h2 id="nxd-up-title">Upcoming</h2>
        <span className="nxd-section__n">{upcoming.length}</span>
        <span className="nxd-section__hint">Scheduled to open</span>
      </header>
      <ol className="nxd-timeline">
        {upcoming.map((c) => {
          const collection = getCollectionById(c.collectionId)
          const to = collection ? `/collections/${collection.slug}` : '/collections'
          return (
            <li key={c.id} className="nxd-tl">
              <div className="nxd-tl__when"><span>Starts</span><b>{c.startsAt}</b></div>
              <span aria-hidden className="nxd-tl__node" />
              <article className="nxd-tl__card">
                <ArtworkFrame src={c.cover} alt="" fallbackLabel="DR" shade="none" parallax={false} sheen={false} className="nxd-tl__art" />
                <div className="nxd-tl__body">
                  <h3><Link to={to} className="nxd-stretch">{c.title}</Link></h3>
                  <p className="nxd-tl__sub">{c.subtitle}</p>
                  <CampaignFacts campaign={c} />
                  {c.eligibilitySummary ? <p className="nxd-tl__elig"><b>Eligibility</b> {c.eligibilitySummary}</p> : null}
                </div>
                <div className="nxd-tl__side">
                  <WatchlistButton kind="campaign" id={c.id} />
                  <span className="nxd-open">Details <ArrowUpRight className="size-3.5" /></span>
                </div>
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
