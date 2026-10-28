import { Search, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useId } from 'react'
import type { Network } from '@/data/types'
import type { CollectionCategory, NetworkId } from '@/data/types'
import { layoutSpring } from '@/lib/motion'
import { cn } from '@/lib/utils'

type Option<T extends string> = { value: T; label: string; count: number; color?: string }

function OptionList<T extends string>({ label, options, value, onChange }: { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  const scope = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="nx-eyebrow mb-1.5 px-2.5">{label}</legend>
      <div className="space-y-0.5" role="group" aria-label={label}>
        {options.map((option) => {
          const active = option.value === value
          const empty = option.count === 0 && !active
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={empty}
              onClick={() => onChange(option.value)}
              className={cn(
                'relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[12.5px] transition-colors duration-150',
                active ? 'text-ink' : 'text-mute hover:text-ink',
                empty && 'cursor-not-allowed opacity-40 hover:text-mute',
              )}
            >
              {active ? (
                <motion.span layoutId={`nx-rail-${scope}`} transition={layoutSpring} className="absolute inset-0 rounded-md border border-copper/20 bg-gradient-to-r from-copper/[0.13] to-copper/[0.03]" />
              ) : (
                <span className="absolute inset-0 rounded-md bg-inset opacity-0 transition-opacity duration-150 hover:opacity-100" />
              )}
              {option.color ? <i className="relative size-1.5 shrink-0 rounded-full" style={{ background: option.color }} /> : null}
              <span className="relative min-w-0 flex-1 truncate capitalize">{option.label}</span>
              <span className="relative font-mono text-[10.5px] tabular-nums text-mute/80">{option.count}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * Left filter rail for the Collections marketplace. Counts always reflect the
 * other active filters, so a choice never leads to an empty result by surprise.
 */
export function FilterRail({
  query,
  onQuery,
  category,
  onCategory,
  network,
  onNetwork,
  categoryOptions,
  networks,
  networkCounts,
  hasFilters,
  onReset,
}: {
  query: string
  onQuery: (v: string) => void
  category: CollectionCategory | 'all'
  onCategory: (v: CollectionCategory | 'all') => void
  network: NetworkId | 'all'
  onNetwork: (v: NetworkId | 'all') => void
  categoryOptions: Option<CollectionCategory | 'all'>[]
  networks: Network[]
  networkCounts: Record<string, number>
  hasFilters: boolean
  onReset: () => void
}) {
  const networkOptions: Option<NetworkId | 'all'>[] = [
    { value: 'all', label: 'All networks', count: networkCounts.all ?? 0 },
    ...networks.map((n) => ({ value: n.id, label: n.name, count: networkCounts[n.id] ?? 0, color: n.color })),
  ]

  return (
    <div className="nx-panel space-y-5 rounded-xl p-3">
      <label className="nx-field relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-mute" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search collections"
          aria-label="Search collections or studios"
          className="h-full w-full bg-transparent pl-9 pr-8 text-[13px] text-ink outline-none placeholder:text-mute/70"
        />
        {query ? (
          <button type="button" onClick={() => onQuery('')} aria-label="Clear search" className="absolute right-2 rounded p-1 text-mute hover:text-ink">
            <X className="size-3.5" />
          </button>
        ) : null}
      </label>
      <OptionList label="Category" options={categoryOptions} value={category} onChange={onCategory} />
      <OptionList label="Network" options={networkOptions} value={network} onChange={onNetwork} />
      {hasFilters ? (
        <button type="button" onClick={onReset} className="w-full rounded-md border border-line py-1.5 text-[12px] text-copper transition-colors hover:border-copper/35 hover:text-ink">
          Reset all filters
        </button>
      ) : null}
    </div>
  )
}
