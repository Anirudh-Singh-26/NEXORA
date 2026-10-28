import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Segmented } from '@/components/shared/segmented'
import { CollectionArt } from '@/features/collections/components/collection-parts'
import { LoadMore, Note, RetryNote } from '@/features/collections/live/live-ui'
import { fullDate, shortAddress, timeAgo } from '@/features/collections/live/live-format'
import { useCollectionActivity } from '@/hooks/use-collection-activity'
import type { ActivityEvent, ActivityType } from '@/lib/nft-data/collection-extras'
import { fmtFloor, NO_VALUE } from '@/lib/nft-data/format'

const LABEL: Record<ActivityType, string> = { sale: 'Sale', listing: 'Listing', transfer: 'Transfer' }

function EventRow({ event, collectionName }: { event: ActivityEvent; collectionName: string }) {
  const title = event.name ?? (event.identifier ? `${collectionName} #${event.identifier.length > 12 ? `${event.identifier.slice(0, 5)}…${event.identifier.slice(-4)}` : event.identifier}` : collectionName)
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line/70 px-4 py-2.5 last:border-0 sm:grid-cols-[auto_minmax(0,1fr)_minmax(120px,0.8fr)_auto]">
      <CollectionArt src={event.image} alt={title} fallbackLabel={(event.identifier ?? '#').slice(0, 4)} shade="none" parallax={false} sheen={false} className="size-10 rounded-lg" />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium" title={title}>{title}</p>
        <p className="text-[11px] text-mute">{LABEL[event.type]}{event.quantity && event.quantity > 1 ? ` · ×${event.quantity}` : ''}</p>
      </div>
      <p className="hidden min-w-0 items-center gap-1.5 truncate font-mono text-[11px] text-mute sm:flex" aria-label="From and to">
        <span className="truncate" title={event.from ?? undefined}>{shortAddress(event.from)}</span>
        {event.to ? (<><ArrowRight className="size-3 shrink-0" aria-hidden /><span className="truncate" title={event.to}>{shortAddress(event.to)}</span></>) : null}
      </p>
      <div className="text-right">
        <p className="font-mono text-[12.5px] tabular-nums">{event.price ? fmtFloor(event.price) : NO_VALUE}</p>
        <p className="font-mono text-[10.5px] tabular-nums text-mute" title={fullDate(event.timestamp)}>{timeAgo(event.timestamp)}</p>
      </div>
    </li>
  )
}

/** Live recent activity (sales / listings / transfers) straight from OpenSea; fetched only once this tab is opened. */
export function LiveActivityPanel({ slug, collectionName }: { slug: string; collectionName: string }) {
  const [type, setType] = useState<ActivityType>('sale')
  const state = useCollectionActivity(slug, type, true)
  return (
    <div className="space-y-3.5">
      <Segmented<ActivityType>
        label="Activity type"
        value={type}
        onChange={setType}
        options={[{ value: 'sale', label: 'Sales' }, { value: 'listing', label: 'Listings' }, { value: 'transfer', label: 'Transfers' }]}
      />
      {state.status === 'loading' || state.status === 'idle' ? (
        <div className="space-y-2" role="status" aria-label="Loading activity">{Array.from({ length: 6 }, (_, i) => <div key={i} className="nx-skeleton h-14 rounded-xl" aria-hidden />)}</div>
      ) : state.status === 'error' ? (
        <RetryNote message={state.error ?? 'Activity could not be loaded.'} onRetry={state.retry} />
      ) : state.events.length === 0 ? (
        <Note>OpenSea reported no recent {LABEL[type].toLowerCase()} activity for this collection.</Note>
      ) : (
        <div className="nx-surface overflow-hidden rounded-xl">
          <div className="border-b border-line/80 px-4 py-3">
            <p className="text-[13px] font-medium">Recent {LABEL[type].toLowerCase()}s</p>
            <p className="text-[11px] text-mute">Newest first, as reported by OpenSea. Prices are in each event’s own payment currency.</p>
          </div>
          <ul>{state.events.map((e) => <EventRow key={e.id} event={e} collectionName={collectionName} />)}</ul>
        </div>
      )}
      {state.status === 'ready' && state.next ? <LoadMore loading={state.loadingMore} error={state.loadMoreError} onClick={state.loadMore} label="Load older activity" /> : null}
    </div>
  )
}
