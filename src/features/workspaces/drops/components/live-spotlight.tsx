import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import { getCollectionById } from '@/data/selectors'
import type { Campaign } from '@/data/types'
import { formatFloor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CampaignFacts } from '@/features/workspaces/drops/components/campaign-facts'

function href(campaign: Campaign) {
  const collection = getCollectionById(campaign.collectionId)
  return collection ? `/collections/${collection.slug}` : '/collections'
}

function LiveCard({ campaign, featured }: { campaign: Campaign; featured?: boolean }) {
  const collection = getCollectionById(campaign.collectionId)
  return (
    <article className={cn('nxd-live', featured && 'is-featured')}>
      <ArtworkFrame src={campaign.cover} alt="" fallbackLabel="DR" shade="none" parallax={false} sheen={false} className="nxd-live__art" />
      <div aria-hidden className="nxd-live__scrim" />
      <div className="nxd-live__top">
        <span className="nxd-status is-live"><span className="nx-live-dot" /> Live</span>
        <span className="nxd-when">{campaign.startsAt}</span>
      </div>
      <div className="nxd-live__body">
        <h3><Link to={href(campaign)} className="nxd-stretch">{campaign.title}</Link></h3>
        <p className="nxd-live__sub">{campaign.subtitle}</p>
        {featured && campaign.eligibilitySummary ? <p className="nxd-live__elig"><b>Eligibility</b> {campaign.eligibilitySummary}</p> : null}
        <CampaignFacts campaign={campaign} />
        <div className="nxd-live__foot">
          {collection ? <span>{collection.name} · Floor <b>{formatFloor(collection.floor, collection.floorSymbol)}</b></span> : <span />}
          <span className="nxd-open">View <ArrowUpRight className="size-3.5" /></span>
        </div>
      </div>
      <div className="nxd-live__watch"><WatchlistButton kind="campaign" id={campaign.id} /></div>
    </article>
  )
}

/** Open right now: one large feature, remaining live campaigns stacked beside it. */
export function LiveSpotlight({ live }: { live: Campaign[] }) {
  if (live.length === 0) return null
  const [lead, ...rest] = live
  return (
    <section className="nxd-section" aria-labelledby="nxd-live-title">
      <header className="nxd-section__head">
        <span className="nx-live-dot" />
        <h2 id="nxd-live-title">Live now</h2>
        <span className="nxd-section__n">{live.length}</span>
        <span className="nxd-section__hint">Open for minting or claims</span>
      </header>
      <div className={cn('nxd-live-grid', rest.length === 0 && 'is-solo')}>
        <LiveCard campaign={lead} featured />
        {rest.length ? <div className="nxd-live-stack">{rest.map((c) => <LiveCard key={c.id} campaign={c} />)}</div> : null}
      </div>
    </section>
  )
}
