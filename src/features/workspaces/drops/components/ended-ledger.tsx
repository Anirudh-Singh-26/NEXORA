import { Link } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { NetworkChip } from '@/components/shared/network-chip'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import { getCollectionById } from '@/data/selectors'
import type { Campaign } from '@/data/types'

/** Closed campaigns: a quiet archive, visually subordinate to live and upcoming. */
export function EndedLedger({ ended }: { ended: Campaign[] }) {
  if (ended.length === 0) return null
  return (
    <section className="nxd-section" aria-labelledby="nxd-end-title">
      <header className="nxd-section__head">
        <i className="nxd-dot" aria-hidden />
        <h2 id="nxd-end-title">Ended</h2>
        <span className="nxd-section__n">{ended.length}</span>
        <span className="nxd-section__hint">Closed campaigns</span>
      </header>
      <ul className="nxd-ledger">
        {ended.map((c) => {
          const collection = getCollectionById(c.collectionId)
          return (
            <li key={c.id} className="nxd-ledger__row">
              <ArtworkFrame src={c.cover} alt="" fallbackLabel="DR" shade="none" parallax={false} sheen={false} className="nxd-ledger__art" />
              <div className="min-w-0">
                <Link to={collection ? `/collections/${collection.slug}` : '/collections'} className="nxd-ledger__title">{c.title}</Link>
                <p>{c.subtitle}</p>
              </div>
              <span className="nxd-ledger__net">{c.networkId ? <NetworkChip id={c.networkId} /> : null}</span>
              <span className="nxd-ledger__date">{c.startsAt}</span>
              <WatchlistButton kind="campaign" id={c.id} compact />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
