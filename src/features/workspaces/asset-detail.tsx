import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, ChevronRight, Maximize2 } from 'lucide-react'
import { TokenGlyph } from '@/components/shared/token-glyph'
import { catalog } from '@/data/catalog'
import type { Collection, NftItem } from '@/data/types'
import { formatCompact, formatFloor, formatPercent, formatUsd } from '@/lib/format'
import { ease } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { getNetwork, getToken } from '@/data/selectors'
import { NetworkChip } from '@/components/shared/network-chip'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { ItemCard } from '@/components/shared/item-card'
import { TiltSurface } from '@/components/shared/tilt-surface'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { MediaImage } from '@/components/shared/media-image'
import { EmptyState } from '@/components/shared/empty-state'

export function AssetDetailPage() {
  const { assetId = '' } = useParams()
  const collection = catalog.collections.find((item) => item.nfts.some((asset) => asset.id === assetId))
  const asset = collection?.nfts.find((item) => item.id === assetId)
  if (!collection || !asset) return <EmptyState title="Asset not found" body="This asset ID is not present in the local demo catalog." action={<Link className="text-copper underline" to="/collections">Browse collections</Link>} />
  // Keyed so local state and animations reset when moving between pieces.
  return <AssetDetail key={asset.id} collection={collection} asset={asset} />
}


function AssetDetail({ collection, asset }: { collection: Collection; asset: NftItem }) {
  const [viewer, setViewer] = useState(false)
  const network = getNetwork(collection.networkId)
  const symbol = collection.floorSymbol
  const siblings = collection.nfts
  const position = siblings.findIndex((n) => n.id === asset.id)
  const prev = siblings[(position - 1 + siblings.length) % siblings.length]
  const next = siblings[(position + 1) % siblings.length]
  const others = siblings.filter((n) => n.id !== asset.id)
  const linkedToken = collection.linkedTokenId ? getToken(collection.linkedTokenId) : undefined

  const premium = collection.floor > 0 ? ((asset.lastSale - collection.floor) / collection.floor) * 100 : 0
  const rankBySale = [...siblings].sort((a, b) => b.lastSale - a.lastSale).findIndex((n) => n.id === asset.id) + 1
  const maxSale = Math.max(...siblings.map((n) => n.lastSale), collection.floor)
  const floorPct = (collection.floor / maxSale) * 100

  const properties: [string, string][] = [
    ['Token ID', `#${asset.tokenId}`],
    ['Network', network?.name ?? collection.networkId],
    ['Category', collection.category.charAt(0).toUpperCase() + collection.category.slice(1)],
    ['Creator', collection.creator],
    ['Sample position', `${position + 1} of ${siblings.length}`],
    ['Sale rank', `${rankBySale} of ${siblings.length}`],
    ['Content type', asset.contentType ?? 'Digital collectible'],
    ['Collection supply', asset.collectionSupply?.toLocaleString('en-US') ?? collection.items.toLocaleString('en-US')],
    ['Edition rarity', asset.rarity ?? 'Unranked'],
  ]

  return (
    <div className="space-y-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12px] text-mute">
        <Link to="/collections" className="transition-colors hover:text-ink">Collections</Link>
        <ChevronRight className="size-3 opacity-50" />
        <Link to={`/collections/${collection.slug}`} className="transition-colors hover:text-ink">{collection.name}</Link>
        <ChevronRight className="size-3 opacity-50" />
        <span className="text-ink">{asset.name}</span>
      </nav>

      {/* ── Gallery stage ───────────────────────────────────── */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-line/80 bg-raised/60">
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <MediaImage src={asset.image} alt="" className="size-full scale-125 opacity-40 blur-3xl saturate-150" />
          <div className="absolute inset-0 bg-gradient-to-br from-canvas/60 via-canvas/75 to-canvas/95" />
        </div>
        <div className="grid items-center gap-8 p-5 md:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)] lg:gap-12 lg:p-10">
          {/* artwork on a matte */}
          <motion.div initial={{ opacity: 0, y: 14, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, ease }} className="mx-auto w-full max-w-[560px]">
            <TiltSurface max={3} className="rounded-2xl">
              <div className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-3 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9),0_24px_60px_-30px_rgba(92,68,224,0.55)] md:p-4">
                <ArtworkFrame src={asset.image} alt={asset.name} fallbackLabel={asset.tokenId} shade="none" parallax={false} className="aspect-square rounded-lg">
                  <span className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-canvas/60 px-2 py-1 font-mono text-[11px] backdrop-blur">#{asset.tokenId}</span>
                  <button type="button" onClick={() => setViewer(true)} className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-canvas/60 px-2.5 py-1 text-[11px] backdrop-blur transition-colors hover:border-copper/50" aria-label={`View ${asset.name} full size`}>
                    <Maximize2 className="size-3" /> Full size
                  </button>
                </ArtworkFrame>
              </div>
            </TiltSurface>
          </motion.div>

          {/* wall label */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.12 }} className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <NetworkChip id={collection.networkId} className="bg-canvas/50" />
                <span className="nx-eyebrow text-[9.5px] text-copper">Digital asset · Demo</span>
              </div>
              <h1 className="mt-4 font-display text-[clamp(2.2rem,4.5vw,3.6rem)] font-semibold leading-[0.98] tracking-[-0.04em]">{asset.name}</h1>
              <p className="mt-3 text-[13px] text-mute">
                From <Link className="text-ink underline decoration-line underline-offset-4 transition-colors hover:text-copper hover:decoration-copper" to={`/collections/${collection.slug}`}>{collection.name}</Link>
                <span className="mx-2 text-mute/40">·</span>by {collection.creator}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-canvas/50 p-5 backdrop-blur">
              <p className="nx-eyebrow text-[9.5px]">Last sale</p>
              <p className="mt-2 flex items-baseline gap-2 font-mono tabular-nums"><span className="text-[34px] leading-none">{asset.lastSale}</span><span className="text-[15px] text-mute">{symbol}</span></p>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-mute">
                <span className={cn('font-mono tabular-nums', premium >= 0 ? 'text-gain' : 'text-loss')}>{formatPercent(premium)}</span>
                <span>vs collection floor of <span className="font-mono tabular-nums text-ink">{formatFloor(collection.floor, symbol)}</span></span>
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
                <WatchlistButton kind="asset" id={asset.id} />
                <Link to={`/collections/${collection.slug}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-xs text-ink transition-colors hover:bg-inset">View collection <ArrowRight size={13} /></Link>
              </div>
            </div>

            <div className="max-w-xl space-y-2">
              <p className="text-[13px] leading-6 text-mute">{asset.description ?? collection.description}</p>
              {asset.utility ? <p className="text-[12px] leading-5 text-mute/85"><span className="text-ink/80">Use case:</span> {asset.utility}</p> : null}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Properties + price context ──────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <section className="nx-surface rounded-2xl p-5" aria-label="Properties">
          <h2 className="nx-eyebrow text-[9.5px]">Properties</h2>
          <dl className="mt-4 grid grid-cols-2 gap-2.5">
            {properties.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line/70 bg-canvas/40 px-3.5 py-3">
                <dt className="nx-eyebrow text-[9px]">{label}</dt>
                <dd className="mt-1.5 truncate text-[13.5px] font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {asset.attributes?.length ? (
            <div className="mt-4 border-t border-line/70 pt-4">
              <h3 className="nx-eyebrow text-[9px]">Edition traits</h3>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                {asset.attributes.map((trait) => (
                  <div key={trait.traitType} className="rounded-lg border border-line/70 bg-canvas/40 px-3 py-2.5">
                    <dt className="nx-eyebrow text-[8.5px]">{trait.traitType}</dt>
                    <dd className="mt-1 text-[12px] font-medium">{trait.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          {asset.curatorNote ? <p className="mt-3 text-[11px] leading-5 text-mute">{asset.curatorNote}</p> : null}
          {asset.rarityBasis ? <p className="mt-2 text-[10.5px] leading-4 text-mute/70">{asset.rarityBasis}</p> : null}
          {asset.lastSaleContext ? <p className="mt-2 text-[10.5px] leading-4 text-mute/70">{asset.lastSaleContext}</p> : null}
          {asset.provenance ? <p className="mt-2 text-[10.5px] leading-4 text-mute/70">{asset.provenance}</p> : null}
        </section>

        <section className="nx-surface rounded-2xl p-5" aria-label="Price context">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="nx-eyebrow text-[9.5px]">Last sale across this collection</h2>
            <span className="font-mono text-[10.5px] text-mute">{symbol}</span>
          </div>
          <ul className="relative mt-4 space-y-2.5">
            <span aria-hidden className="pointer-events-none absolute inset-y-0 border-l border-dashed border-copper/50" style={{ left: `calc(8.25rem + (100% - 12.5rem) * ${floorPct / 100})` }} />
            {siblings.map((n) => {
              const current = n.id === asset.id
              return (
                <li key={n.id}>
                  <Link to={`/assets/${n.id}`} className={cn('group flex items-center gap-3 rounded-md py-0.5 text-[12px]', current ? 'text-ink' : 'text-mute hover:text-ink')} aria-current={current ? 'page' : undefined}>
                    <span className="w-[7.5rem] truncate">{n.name}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-line/50">
                      <motion.span className={cn('absolute inset-y-0 left-0 rounded-full', current ? 'bg-gradient-to-r from-copper to-sage' : 'bg-mute/40 group-hover:bg-mute/60')} initial={{ width: 0 }} animate={{ width: `${(n.lastSale / maxSale) * 100}%` }} transition={{ duration: 0.8, ease, delay: 0.15 }} />
                    </span>
                    <span className="w-14 text-right font-mono tabular-nums">{n.lastSale}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <p className="mt-4 flex items-center gap-2 text-[11px] text-mute"><span className="h-3 border-l border-dashed border-copper/60" /> Collection floor {formatFloor(collection.floor, symbol)}</p>
        </section>
      </div>

      {/* ── Collection context ──────────────────────────────── */}
      <section aria-label="Collection context" className="nx-panel relative overflow-hidden rounded-2xl">
        <div aria-hidden className="absolute inset-0"><MediaImage src={collection.banner || collection.cover} alt="" className="size-full opacity-25" /><div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/85 to-canvas/40" /></div>
        <div className="relative grid gap-6 p-5 md:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-xl">
            <p className="nx-eyebrow text-[9.5px]">Collection</p>
            <h2 className="mt-1.5 font-display text-[26px] font-semibold tracking-tight">{collection.name}</h2>
            <p className="mt-2 text-[12.5px] leading-5 text-mute">{collection.description}</p>
            {linkedToken ? <Link to={`/tokens/${linkedToken.id}`} className="mt-3 inline-flex items-center gap-2 text-[12px] text-mute transition-colors hover:text-ink"><TokenGlyph token={linkedToken} className="size-6 text-[9px]" /> Quoted against {linkedToken.name} <span className="font-mono tabular-nums text-ink">{formatUsd(linkedToken.price)}</span></Link> : null}
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4 lg:grid-cols-2">
            {[['Floor', formatFloor(collection.floor, symbol)], ['24h volume', formatCompact(collection.volume24h)], ['Items', collection.items.toLocaleString('en-US')], ['Owners', collection.owners.toLocaleString('en-US')]].map(([l, v]) => (
              <div key={l}><dt className="nx-eyebrow text-[9px]">{l}</dt><dd className="mt-1 font-mono text-[15px] tabular-nums">{v}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Related pieces ──────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="nx-kicker">Same collection</p>
            <h2 className="mt-1.5 text-[19px] font-semibold tracking-tight">More from {collection.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/assets/${prev.id}`} aria-label={`Previous piece: ${prev.name}`} className="flex size-8 items-center justify-center rounded-md border border-line text-mute transition-colors hover:border-copper/40 hover:text-ink"><ArrowLeft size={15} /></Link>
            <Link to={`/assets/${next.id}`} aria-label={`Next piece: ${next.name}`} className="flex size-8 items-center justify-center rounded-md border border-line text-mute transition-colors hover:border-copper/40 hover:text-ink"><ArrowRight size={15} /></Link>
          </div>
        </div>
        {others.length === 0 ? (
          <EmptyState title="Only piece in the demo set" body="No other sample items exist for this collection." />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {others.map((item) => <ItemCard key={item.id} nft={item} symbol={symbol} />)}
          </div>
        )}
      </section>

      <p className="rounded-lg border border-dashed border-line/80 px-3.5 py-2.5 text-[11.5px] leading-5 text-mute">
        Demo-only asset detail. Ownership and sale figures are illustrative and are not verified on-chain.
      </p>

      <Dialog open={viewer} onOpenChange={setViewer}>
        <DialogContent showClose className="top-1/2 w-[min(880px,calc(100%-1.5rem))] -translate-y-1/2 border-white/10 bg-canvas/95 p-2">
          <DialogTitle className="sr-only">{asset.name}</DialogTitle>
          <DialogDescription className="sr-only">Full size view of {asset.name} from {collection.name}</DialogDescription>
          <MediaImage src={asset.image} alt={asset.name} className="max-h-[80dvh] w-full rounded-lg" fallbackLabel="NFT" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Help & resources: field guide ─────────────────────────────────────── */
