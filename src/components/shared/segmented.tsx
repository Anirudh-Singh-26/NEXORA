import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'
import { layoutSpring } from '@/lib/motion'

export type SegmentedOption<T extends string> = { value: T; label: string; icon?: ReactNode; count?: number }

/**
 * Pill-style segmented control with a sliding indicator (shared by tabs, view
 * toggles and quick filters). Styling lives in `.nx-segmented` (index.css).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (next: T) => void
  label: string
  className?: string
}) {
  const scope = useId()
  return (
    <div className={`nx-segmented ${className ?? ''}`} role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button key={option.value} type="button" aria-pressed={active} onClick={() => onChange(option.value)}>
            {active ? (
              <motion.span
                layoutId={`nx-seg-${scope}`}
                transition={layoutSpring}
                className="absolute inset-0 rounded-[7px] border border-copper/25 bg-copper/[0.12]"
              />
            ) : null}
            <span className="relative flex items-center gap-1.5">
              {option.icon}
              {option.label}
              {option.count !== undefined ? <span className="font-mono text-[10px] text-mute/80">{option.count}</span> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
