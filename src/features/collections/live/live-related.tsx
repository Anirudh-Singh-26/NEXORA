import { useEffect, useMemo, useRef, useState } from 'react'
import { CollectionCard } from '@/components/shared/collection-card'
import { SectionHeader } from '@/components/shared/section-header'
import { catalog } from '@/data/catalog'
import { CollectionArt, CollectionLink } from '@/features/collections/components/collection-parts'
import { Note } from '@/features/collections/live/live-ui'
import { useLiveCollections } from '@/hooks/use-live-collections'
import { fmtFloor } from '@/lib/nft-data/format'
import type { ListedCollection } from '@/lib/nft-data/types'
import type { NetworkId } from '@/data/types'

function RelatedCard({ collection }: { collection: ListedCollection }) {
  return (
    <CollectionLink collection={collection} aria-label={`${collection.name}, open collection`} className="nx-data-card group relative block aspect-[3/2] overflow-hidden rounded-xl border border-line bg-gradient-to-br from-[#121727] to-[#0b0f1a] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_28px_-14px_rgba(0,0,0,0.7)] transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-copper/35 focus-visible:outline-2 focus-visible:outline-copper">
      <CollectionArt src={collection.cover ?? collection.banner} alt={collection.name} fallbackLabel={collection.name.slice(0, 2)} shade="none" className="absolute inset-0 h-full w-full">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090b12]/95 via-[#090b12]/35 via-35% to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
          <h3 className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-base"><span className="truncate">{collection.name}</span></h3>
          <p className="mt-1.5 flex min-w-0 items-baseline gap-1.5 text-[12px] leading-tight text-white/70 sm:text-[13px]">
            <span className="shrink-0">Floor price:</span><span className="truncate font-semibold tabular-nums text-white">{fmtFloor(collection.floor)}</span>
          </p>
        </div>
      </CollectionArt>
    </CollectionLink>
  )
}

/**
 * Mounts its children only once scrolled near the viewport. The related list reuses the Collections listing, whose
 * cold fill costs many OpenSea calls on the server, so a visitor who never scrolls this far never triggers it.
 */
function WhenVisible({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (visible || !el) return
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect() } }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])
  return <div ref={ref}>{visible ? children : fallback}</div>
}

const Skeleton = () => (
  <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading related collections">{Array.from({ length: 4 }, (_, i) => <div key={i} className="nx-skeleton aspect-[3/2] rounded-xl" aria-hidden />)}</div>
)

/**
 * Related collections. Live: other collections from the OpenSea listing on the same network (same rank order the
 * Collections page uses). If the live listing is unavailable, falls back to the NEXORA demo catalogue and says so.
 * OpenSea has no "similar collections" endpoint, so "related" here means "same network".
 */
export function LiveRelated({ slug, networkId }: { slug: string; networkId: NetworkId | null }) {
  return (
    <section aria-label="Related collections">
      <WhenVisible fallback={<><SectionHeader kicker="RELATED COLLECTIONS" title="Similar collections" href="/collections" /><Skeleton /></>}>
        <RelatedBody slug={slug} networkId={networkId} />
      </WhenVisible>
    </section>
  )
}

function RelatedBody({ slug, networkId }: { slug: string; networkId: NetworkId | null }) {
  const live = useLiveCollections()
  const related = useMemo(() => {
    const rows = live.snapshot?.collections.filter((c) => c.slug !== slug) ?? []
    const same = networkId ? rows.filter((c) => c.networkId === networkId) : []
    return (same.length >= 2 ? same : rows).slice(0, 4)
  }, [live.snapshot, slug, networkId])
  const demo = useMemo(() => {
    const all = [...catalog.collections]
    const same = networkId ? all.filter((c) => c.networkId === networkId) : []
    return [...same, ...all.filter((c) => !same.includes(c))].slice(0, 4)
  }, [networkId])

  const useLive = related.length > 0
  return (
    <>
      <SectionHeader
        kicker="RELATED COLLECTIONS"
        title="Similar collections"
        description={useLive || live.status === 'loading' ? 'Other live OpenSea collections from the Collections listing, matched by network.' : 'Demo recommendations — illustrative NEXORA catalogue entries, not OpenSea data.'}
        href="/collections"
      />
      {live.status === 'loading' ? (
        <Skeleton />
      ) : useLive ? (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">{related.map((c) => <RelatedCard key={c.id} collection={c} />)}</div>
      ) : (
        <div className="space-y-3">
          <Note>Live related collections are unavailable{live.error ? ` (${live.error})` : ''}. Showing demo recommendations instead.</Note>
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">{demo.map((c) => <CollectionCard key={c.id} collection={c} showWatchlist={false} />)}</div>
        </div>
      )}
    </>
  )
}
