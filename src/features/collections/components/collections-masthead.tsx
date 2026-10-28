import { useMemo } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { AnimatedValue } from '@/components/shared/animated-value'
import { categories } from '@/data/selectors'
import type { CollectionCategory } from '@/data/types'
import { CollectionArt, CollectionLink } from '@/features/collections/components/collection-parts'
import { fmtVolume, NO_VALUE } from '@/lib/nft-data/format'
import type { ListedCollection } from '@/lib/nft-data/types'
import '@/features/collections/collections-masthead.css'

/**
 * Editorial opening of the Collections page: a large title and standfirst, a
 * four-figure catalogue summary, a category index that filters the directory,
 * and a fanned stack of the three leading covers. Every figure is derived from
 * the catalogue; nothing here is a live market metric.
 */
export function CollectionsMasthead({ ranked, onCategory }: { ranked: ListedCollection[]; onCategory: (category: CollectionCategory) => void }) {
  // A total is only shown when every row supplies the figure; a partial sum would read as a real total.
  const summary = useMemo(() => {
    const creators = ranked.map((c) => c.creator)
    const items = ranked.map((c) => c.items)
    return {
      collections: ranked.length,
      creators: creators.every((v) => v !== null) ? new Set(creators).size : null,
      networks: new Set(ranked.map((c) => c.networkId)).size,
      items: items.every((v): v is number => v !== null) ? items.reduce((sum, v) => sum + v, 0) : null,
    }
  }, [ranked])
  const isLive = ranked.some((c) => c.source === 'live')

  const byCategory = useMemo(
    () => categories.map((category) => ({ category, count: ranked.filter((c) => c.category === category).length })),
    [ranked],
  )
  const leaders = ranked.slice(0, 3)

  return (
    <header className="nxc-mast">
      <div className="nxc-mast__copy">
        <p className="nx-kicker nxc-mast__kicker">Curated marketplace</p>
        <h1 className="nxc-mast__title">Collections</h1>
        <p className="nxc-mast__deck">Discover the editions, creators and communities moving the catalogue, then dig into the full directory.</p>

        <dl className="nxc-mast__stats" aria-label="Catalogue summary">
          <div><dt>Collections</dt><dd><AnimatedValue value={summary.collections} format="compact" /></dd></div>
          <div><dt>Creators</dt><dd>{summary.creators === null ? NO_VALUE : <AnimatedValue value={summary.creators} format="compact" />}</dd></div>
          <div><dt>Networks</dt><dd><AnimatedValue value={summary.networks} format="compact" /></dd></div>
          <div><dt>Items</dt><dd>{summary.items === null ? NO_VALUE : <AnimatedValue value={summary.items} format="compact" />}</dd></div>
        </dl>

        <nav className="nxc-mast__cats" aria-label="Browse by category">
          <span className="nx-eyebrow">Browse by</span>
          {byCategory.map(({ category, count }) => (
            <button key={category} type="button" className="nxc-cat" disabled={count === 0} onClick={() => onCategory(category)}>
              <span className="capitalize">{category}</span>
              <b>{count}</b>
            </button>
          ))}
        </nav>
        <p className="nxc-mast__note">{isLive ? 'Live figures from OpenSea for the collections shown. “—” means the provider supplied no value.' : 'Demo market data, not live on-chain metrics.'}</p>
      </div>

      {leaders.length ? (
        <div className="nxc-fan" role="group" aria-label="Leading collections by 24h volume">
          {leaders.map((c, index) => (
            <CollectionLink key={c.id} collection={c} className={`nxc-fan__card is-${index}`} aria-label={`${c.name}, number ${index + 1} by 24h volume`}>
              <CollectionArt src={c.cover} alt="" fallbackLabel={c.name.slice(0, 2)} shade="none" parallax={false} sheen={false} className="nxc-fan__art" />
              <span className="nxc-fan__cap">
                <small>#{index + 1} · 24h volume</small>
                <b>{c.name}</b>
                <i>{fmtVolume(c.volume24h)} <ArrowUpRight className="size-3" /></i>
              </span>
            </CollectionLink>
          ))}
        </div>
      ) : null}
    </header>
  )
}
