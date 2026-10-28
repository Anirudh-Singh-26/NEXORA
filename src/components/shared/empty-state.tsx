import type { ReactNode } from 'react'

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-line bg-raised/50 px-5 py-8 sm:px-6 sm:py-10">
      <h3 className="font-display text-lg font-semibold leading-snug text-ink sm:text-xl">{title}</h3>
      <p className="max-w-md text-sm leading-6 text-mute">{body}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
