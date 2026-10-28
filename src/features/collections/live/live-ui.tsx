import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/** Informative empty / unavailable state used across the live detail sections. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line bg-raised/40 px-4 py-3 text-[12.5px] leading-5 text-mute">{children}</p>
}

/** A failed request with a retry action (never hides data that is already on screen). */
export function RetryNote({ message, onRetry, busy }: { message: string; onRetry: () => void; busy?: boolean }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-loss/40 bg-raised/40 px-4 py-3 text-[12.5px] leading-5 text-mute">
      <span>{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={busy}>{busy ? 'Retrying…' : 'Retry'}</Button>
    </div>
  )
}

/** Skeleton rows that match the shape of the section they stand in for. */
export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Loading items">
      {Array.from({ length: count }, (_, i) => <div key={i} className="nx-skeleton aspect-[4/5] rounded-xl" aria-hidden />)}
    </div>
  )
}

export function LoadMore({ loading, error, onClick, label = 'Load more' }: { loading: boolean; error: string | null; onClick: () => void; label?: string }) {
  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      {error ? <p role="alert" className="text-[12px] text-loss">{error}</p> : null}
      <Button type="button" variant="outline" onClick={onClick} disabled={loading}>{loading ? 'Loading…' : error ? 'Try again' : label}</Button>
    </div>
  )
}
