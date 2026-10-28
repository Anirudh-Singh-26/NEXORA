import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { dxPanelId, dxTabId } from './dx-tabs-ids'

export type DxTab<T extends string> = { value: T; label: ReactNode; ariaLabel?: string }

/**
 * Accessible tablist with roving tabindex. Arrow keys (both axes), Home and End move
 * focus and selection. Pair the active panel with `id={dxPanelId(prefix)}`.
 */
export function DxTabList<T extends string>({
  label,
  prefix,
  tabs,
  value,
  onChange,
  orientation = 'horizontal',
  className,
  tabClassName,
}: {
  label: string
  prefix: string
  tabs: DxTab<T>[]
  value: T
  onChange: (next: T) => void
  orientation?: 'horizontal' | 'vertical'
  className?: string
  tabClassName?: string
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault()
    const target = tabs[next]
    onChange(target.value)
    refs.current[target.value]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} aria-orientation={orientation} className={className}>
      {tabs.map((tab, index) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            ref={(node) => { refs.current[tab.value] = node }}
            type="button"
            role="tab"
            id={dxTabId(prefix, tab.value)}
            aria-selected={active}
            aria-controls={dxPanelId(prefix)}
            aria-label={tab.ariaLabel}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => move(event, index)}
            className={cn('nx-dx-tab', tabClassName)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
