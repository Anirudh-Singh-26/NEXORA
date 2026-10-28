import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { NetworkChip } from '@/components/shared/network-chip'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import { Byline, CollectionArt, CollectionLink } from '@/features/collections/components/collection-parts'
import { fmtCount, fmtFloor, fmtVolume } from '@/lib/nft-data/format'
import type { ListedCollection } from '@/lib/nft-data/types'

/** Directory tile: banner artwork, overlapping avatar, and a 3-up stat strip. */
export function CollectionTile({ collection }: { collection: ListedCollection }) {
  const preview = collection.preview
  return (
    <article className="nxc-tile group">
      <CollectionLink collection={collection} className="nxc-tile__link" aria-label={`${collection.name}, open collection`}>
        <div className="nxc-tile__art">
          <CollectionArt src={collection.banner ?? collection.cover} alt="" fallbackLabel={collection.name} shade="bottom" parallax={false} className="size-full" />
          <div className="nxc-tile__chip"><NetworkChip id={collection.networkId} className="nx-artwork-network-chip" /></div>
          {preview.length ? (
            <div aria-hidden className="nxc-tile__reel">
              {preview.map((image) => (
                <ArtworkFrame key={image} src={image} alt="" fallbackLabel="" shade="none" parallax={false} sheen={false} className="nxc-tile__mini" />
              ))}
            </div>
          ) : null}
        </div>
        <div className="nxc-tile__body">
          <CollectionArt src={collection.cover} alt="" fallbackLabel={collection.name.slice(0, 2)} shade="none" parallax={false} sheen={false} className="nxc-tile__avatar" />
          <h3 className="nxc-tile__name">{collection.name}</h3>
          <p className="nxc-tile__by"><Byline collection={collection} /></p>
          <dl className="nxc-tile__stats">
            <div><dt>Floor</dt><dd>{fmtFloor(collection.floor)}</dd></div>
            <div><dt>24h vol</dt><dd>{fmtVolume(collection.volume24h)}</dd></div>
            <div><dt>Items</dt><dd>{fmtCount(collection.items)}</dd></div>
          </dl>
        </div>
      </CollectionLink>
      {collection.source === 'demo' ? <div className="nxc-tile__watch"><WatchlistButton kind="collection" id={collection.id} compact /></div> : null}
    </article>
  )
}
