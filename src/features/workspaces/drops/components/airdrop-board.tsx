import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { NetworkChip } from '@/components/shared/network-chip'
import { getCollectionById, getProject } from '@/data/selectors'
import { cn } from '@/lib/utils'
import type { Airdrop } from '@/features/workspaces/drops/drops-data'

/** Research checklist for airdrop records. Eligibility text leads each card. */
export function AirdropBoard({ airdrops, total }: { airdrops: Airdrop[]; total: number }) {
  return (
    <section className="nxd-section nxd-research" aria-labelledby="airdrop-research-heading">
      <header className="nxd-section__head">
        <i className="nxd-dot is-research" aria-hidden />
        <h2 id="airdrop-research-heading">Airdrop research board</h2>
        <span className="nxd-section__n">{airdrops.length}{airdrops.length !== total ? `/${total}` : ''}</span>
        <span className="nxd-section__hint">Demo records · not verified</span>
      </header>
      {airdrops.length === 0 ? (
        <p className="nxd-research__empty">No airdrop records match the current filters.</p>
      ) : (
        <ul className="nxd-airdrops">
          {airdrops.map((drop) => {
            const project = getProject(drop.projectId)
            const collection = project?.collectionId ? getCollectionById(project.collectionId) : undefined
            const live = String(drop.status) === 'live'
            return (
              <li key={drop.id} className="nxd-air">
                <ArtworkFrame src={drop.cover} alt={drop.title} fallbackLabel="DROP" shade="none" parallax={false} sheen={false} className="nxd-air__art" />
                <div className="nxd-air__main">
                  <div className="nxd-air__tags">
                    <span className={cn('nxd-status', live ? 'is-live' : 'is-quiet')}>{String(drop.status)}</span>
                    <NetworkChip id={drop.networkId} />
                    <span className="nxd-air__reward capitalize">{String(drop.rewardType)}</span>
                  </div>
                  <h3>{drop.title}</h3>
                  <p className="nxd-air__elig"><b>Eligibility (illustrative)</b>{drop.eligibilitySummary}</p>
                  <div className="nxd-air__foot">
                    <span>{project?.name ?? 'Demo project'}</span>
                    {collection ? <Link to={`/collections/${collection.slug}`}>View project ↗</Link> : <span>Research only</span>}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="nxd-disclaimer"><ShieldAlert className="size-3.5 shrink-0" /> These are fictional research examples. They do not indicate real eligibility, rewards, or verified campaigns. Never share a wallet seed phrase or private key to participate in a campaign.</p>
    </section>
  )
}
