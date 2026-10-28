import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MediaImage } from '@/components/shared/media-image'
import { catalog, nftItems } from '@/data/catalog'
import { RailSourceTag } from '@/features/discover/rail-source-tag'
import { useLiveCollections } from '@/hooks/use-live-collections'
import { liveCollectionHref, pickRailCollections } from '@/lib/discover/rails'
import { formatFloor } from '@/lib/format'
import { COLLECTIONS_SOURCE } from '@/lib/nft-data/collections'
import { fmtFloor, fmtVolume } from '@/lib/nft-data/format'
import './moving-nft-rail.css'

/**
 * Compact marketplace-style NFT rail.
 * Live: top collections by 24h volume from OpenSea (via the /api/collections proxy), showing only the fields the
 * provider returned. Until it loads, or if it fails, the existing demo NFTs are shown under an explicit
 * "Illustrative data" label; a failed live request is never presented as real data.
 */
export function MovingNftRail() {
  const live = useLiveCollections()
  const liveRows = live.status === 'ready' && live.snapshot ? pickRailCollections(live.snapshot.collections, 12) : []
  if (liveRows.length > 0) return <LiveCollectionRail rows={liveRows} fetchedAt={live.snapshot?.fetchedAt ?? null} />
  return <DemoNftRail state={live.status === 'error' ? 'unavailable' : 'loading'} note={live.error} />
}

function LiveCollectionRail({ rows, fetchedAt }: { rows: ReturnType<typeof pickRailCollections>; fetchedAt: number | null }) {
  const renderRow = (c: (typeof rows)[number], duplicate = false) => {
    const network = catalog.networks.find((entry) => entry.id === c.networkId)
    const floor = c.floor ? fmtFloor(c.floor) : null
    return (
      <Link
        key={`${duplicate ? 'duplicate-' : ''}${c.id}`}
        to={liveCollectionHref(c)}
        tabIndex={duplicate ? -1 : undefined}
        aria-hidden={duplicate || undefined}
        className="nx-nft-market-rail__card group"
        aria-label={duplicate ? undefined : `${c.name}, 24h volume ${fmtVolume(c.volume24h)}${floor ? `, floor ${floor}` : ''}`}
      >
        <span className="nx-nft-market-rail__art">
          {c.cover
            ? <MediaImage src={c.cover} alt={duplicate ? '' : c.name} fallbackLabel={c.name.slice(0, 2).toUpperCase()} />
            : <span className="mesh-fallback flex h-full w-full items-center justify-center text-xs font-medium tracking-[0.2em] text-mute" aria-hidden="true">{c.name.slice(0, 2).toUpperCase()}</span>}
        </span>
        <span className="nx-nft-market-rail__details">
          <span className="nx-nft-market-rail__title-row">
            <span className="nx-nft-market-rail__name">{c.name}</span>
            <ArrowUpRight aria-hidden className="nx-nft-market-rail__arrow" />
          </span>
          <span className="nx-nft-market-rail__collection">Rank #{c.rank ?? '—'} by 24h volume</span>
          <span className="nx-nft-market-rail__meta">
            <span className="nx-nft-market-rail__sale">
              <span className="nx-nft-market-rail__label">24h volume</span>
              <span className="nx-nft-market-rail__price">{fmtVolume(c.volume24h)}</span>
            </span>
            <span className="nx-nft-market-rail__meta-side">
              {floor ? (
                <span className="nx-nft-market-rail__floor" title={`Collection floor ${floor}`}>
                  <span className="nx-nft-market-rail__label">Floor</span>
                  <span className="nx-nft-market-rail__price">{floor}</span>
                </span>
              ) : null}
              {network ? <span className="nx-nft-market-rail__network">{network.shortName}</span> : null}
            </span>
          </span>
        </span>
      </Link>
    )
  }
  return (
    <section className="nx-nft-market-rail" aria-label="Top collections">
      <RailSourceTag state="live" label="collection data" source={COLLECTIONS_SOURCE.name} sourceUrl={COLLECTIONS_SOURCE.url} updatedAt={fetchedAt} />
      <div className="nx-nft-market-rail__viewport" role="region" aria-label="Automatically scrolling top collections">
        <div className="nx-nft-market-rail__track">
          <div className="nx-nft-market-rail__group">{rows.map((c) => renderRow(c))}</div>
          <div className="nx-nft-market-rail__group" aria-hidden="true">{rows.map((c) => renderRow(c, true))}</div>
        </div>
      </div>
    </section>
  )
}

function DemoNftRail({ state, note }: { state: 'loading' | 'unavailable'; note: string | null }) {
  // Keep the entire catalog in the marquee; every NFT is represented before the
  // seamless visual loop repeats the sequence.
  const items = [...nftItems].sort((a, b) => b.lastSale - a.lastSale)

  if (!items.length) return null

  const renderNft = (nft: (typeof items)[number], duplicate = false) => {
    const collection = catalog.collections.find((entry) => entry.id === nft.collectionId)
    const network = catalog.networks.find((entry) => entry.id === nft.networkId)
    const currency = collection?.floorSymbol ?? network?.nativeSymbol ?? ''
    const floorPrice = collection ? formatFloor(collection.floor, currency) : null

    return (
      <Link
        key={`${duplicate ? 'duplicate-' : ''}${nft.id}`}
        to={`/assets/${nft.id}`}
        tabIndex={duplicate ? -1 : undefined}
        aria-hidden={duplicate || undefined}
        className="nx-nft-market-rail__card group"
        aria-label={duplicate ? undefined : `${nft.name}, from ${nft.collectionName}, last sale ${formatFloor(nft.lastSale, currency)}`}
      >
        <span className="nx-nft-market-rail__art">
          <MediaImage src={nft.image} alt={duplicate ? '' : nft.imageAlt ?? nft.name} fallbackLabel={nft.name.slice(0, 2).toUpperCase()} />
        </span>

        <span className="nx-nft-market-rail__details">
          <span className="nx-nft-market-rail__title-row">
            <span className="nx-nft-market-rail__name">{nft.name}</span>
            <ArrowUpRight aria-hidden className="nx-nft-market-rail__arrow" />
          </span>
          <span className="nx-nft-market-rail__collection">{nft.collectionName}</span>
          <span className="nx-nft-market-rail__meta">
            <span className="nx-nft-market-rail__sale">
              <span className="nx-nft-market-rail__label">Last sale</span>
              <span className="nx-nft-market-rail__price">{formatFloor(nft.lastSale, currency)}</span>
            </span>
            <span className="nx-nft-market-rail__meta-side">
              {floorPrice ? (
                <span className="nx-nft-market-rail__floor" title={`Collection floor ${floorPrice}`}>
                  <span className="nx-nft-market-rail__label">Floor</span>
                  <span className="nx-nft-market-rail__price">{floorPrice}</span>
                </span>
              ) : null}
              {network ? <span className="nx-nft-market-rail__network">{network.shortName}</span> : null}
            </span>
          </span>
        </span>
      </Link>
    )
  }

  return (
    <section className="nx-nft-market-rail" aria-label="Featured NFTs">
      <RailSourceTag state={state} label="collection data" source={COLLECTIONS_SOURCE.name} sourceUrl={COLLECTIONS_SOURCE.url} note={note} />
      <div className="nx-nft-market-rail__viewport" role="region" aria-label="Automatically scrolling featured NFTs">
        <div className="nx-nft-market-rail__track">
          <div className="nx-nft-market-rail__group">{items.map((nft) => renderNft(nft))}</div>
          <div className="nx-nft-market-rail__group" aria-hidden="true">{items.map((nft) => renderNft(nft, true))}</div>
        </div>
      </div>
    </section>
  )
}
