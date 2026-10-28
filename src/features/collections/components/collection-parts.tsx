import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { cn } from '@/lib/utils'
import type { ListedCollection } from '@/lib/nft-data/types'

/** ArtworkFrame that degrades to the branded mesh tile when there is no artwork URL at all (a broken URL is handled by MediaImage). */
export function CollectionArt({ src, alt, fallbackLabel, className, ...rest }: Omit<ComponentProps<typeof ArtworkFrame>, 'src'> & { src: string | null }) {
  if (src) return <ArtworkFrame src={src} alt={alt} fallbackLabel={fallbackLabel} className={className} {...rest} />
  return (
    <div className={cn('mesh-fallback flex items-center justify-center text-xs font-medium tracking-[0.2em] text-mute', className)} role="img" aria-label={alt}>
      {fallbackLabel}
    </div>
  )
}

/**
 * Always an in-app link. Demo collections open their demo detail page; live collections open the same route with
 * `?source=opensea` so the detail page loads them from the proxy by slug (the explicit "View on OpenSea" link on
 * that page is the only external hop).
 */
export function CollectionLink({ collection, className, children, ...rest }: { collection: ListedCollection; className?: string; children: ReactNode; 'aria-label'?: string }) {
  const to = collection.source === 'live' ? `/collections/${encodeURIComponent(collection.slug)}?source=opensea` : `/collections/${collection.slug}`
  return <Link to={to} className={className} {...rest}>{children}</Link>
}

/** "creator · category", omitting whichever part is unknown. */
export function Byline({ collection }: { collection: ListedCollection }) {
  return (
    <>
      {collection.creator}
      {collection.creator && collection.category ? ' · ' : ''}
      {collection.category ? <span className="capitalize">{collection.category}</span> : null}
      {!collection.creator && !collection.category ? 'NFT collection' : null}
    </>
  )
}
