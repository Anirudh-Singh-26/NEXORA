import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bookmark, CheckCheck, Rocket, TrendingUp } from 'lucide-react'
import { Segmented } from '@/components/shared/segmented'
import { notificationSeeds } from '@/data/catalog'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/empty-state'

const inboxItems = notificationSeeds


export function NotificationsWorkspace() {
  const [readIds, setReadIds] = useState<string[]>([])
  const [view, setView] = useState<'all' | 'unread'>('all')
  const unread = inboxItems.filter((i) => !readIds.includes(i.id)).length
  const items = view === 'unread' ? inboxItems.filter((i) => !readIds.includes(i.id)) : inboxItems
  const toggle = (id: string) => setReadIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<'all' | 'unread'> label="Inbox view" value={view} onChange={setView} options={[{ value: 'all', label: 'All', count: inboxItems.length }, { value: 'unread', label: 'Unread', count: unread }]} />
        <button type="button" disabled={unread === 0} onClick={() => setReadIds(inboxItems.map((i) => i.id))} className="inline-flex items-center gap-1.5 text-[12px] text-copper transition-colors hover:text-ink disabled:cursor-not-allowed disabled:text-mute/50">
          <CheckCheck size={14} /> Mark all read
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState title="You’re all caught up" body="No unread notifications. Switch to All to review earlier items." action={<button type="button" onClick={() => setView('all')} className="text-sm text-copper hover:underline">Show all</button>} />
      ) : (
        <ul className="nx-surface divide-y divide-line/70 overflow-hidden rounded-xl">
          {items.map((item) => {
            const read = readIds.includes(item.id)
            return (
              <li key={item.id} className={cn('relative flex gap-4 p-5 transition-colors', read ? 'opacity-60' : 'bg-copper/[0.03]')}>
                {!read ? <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-copper" /> : null}
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-inset text-copper">{item.iconKey === 'watchlist' ? <Bookmark size={15} /> : item.iconKey === 'campaign' ? <Rocket size={15} /> : <TrendingUp size={15} />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13.5px] font-medium">{item.title}{!read ? <span className="sr-only"> (unread)</span> : null}</p>
                    <span className="shrink-0 text-[11px] text-mute">{item.time}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-5 text-mute">{item.body}</p>
                  <div className="mt-2.5 flex items-center gap-4 text-[12px]">
                    <Link to={item.href} className="inline-flex items-center gap-1 text-copper hover:text-ink">Open related page <ArrowRight size={13} /></Link>
                    <button type="button" onClick={() => toggle(item.id)} className="text-mute underline underline-offset-4 hover:text-ink">{read ? 'Mark unread' : 'Mark read'}</button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ── Assistant: scripted chat with topic rail ──────────────────────────── */
