import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ErrorState({
  title = 'This panel could not load',
  body = 'The prototype hit a local rendering issue. Try again without leaving the page.',
  onRetry,
}: {
  title?: string
  body?: string
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="flex items-start gap-4 rounded-xl border border-loss/30 bg-loss/[0.05] px-5 py-6 sm:px-6 sm:py-7">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-loss/35 text-loss" aria-hidden="true">
        <CircleAlert size={18} />
      </span>
      <div className="flex min-w-0 flex-col items-start gap-2">
        <h3 className="font-display text-lg font-semibold leading-snug text-ink sm:text-xl">{title}</h3>
        <p className="max-w-lg text-sm leading-6 text-mute">{body}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  )
}
