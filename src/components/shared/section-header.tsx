import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function SectionHeader({
  kicker,
  title,
  href,
  action,
  description,
}: {
  kicker: string
  title: string
  href?: string
  action?: ReactNode
  description?: string
}) {
  return (
    <div className="nx-section-header mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p className="nx-kicker">
          {kicker}
        </p>
        <h2 className="mt-1 text-[19px] font-semibold leading-tight tracking-tight text-ink md:text-[21px]">{title}</h2>
        {description ? <p className="mt-1 max-w-xl text-[12.5px] leading-[1.55] text-mute">{description}</p> : null}
      </div>
      {href ? (
        <Link to={href} className="group inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-[12px] text-mute transition-colors hover:text-ink">
          View all
          <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5" />
        </Link>
      ) : (
        action
      )}
    </div>
  )
}
