import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Segmented } from '@/components/shared/segmented'
import { formatUsdCompact } from '@/lib/format'
import { ease } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { metricValue, type AtlasEntry, type CompareMetric, type NetworkSelection } from '@/features/workspaces/ecosystems/atlas-data'

/** Ranked bars for one metric at a time; rows focus the network they belong to. */
export function NetworkComparison({ atlas, selected, onSelect }: { atlas: AtlasEntry[]; selected: NetworkSelection; onSelect: (id: NetworkSelection) => void }) {
  const [metric, setMetric] = useState<CompareMetric>('projects')
  const rows = useMemo(() => [...atlas].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)), [atlas, metric])
  const max = Math.max(...rows.map((r) => metricValue(r, metric)), 1)
  const show = (v: number) => (metric === 'cap' ? (v ? formatUsdCompact(v) : '—') : String(v))

  return (
    <section className="nxe-compare" aria-labelledby="nxe-compare-title">
      <header className="nxe-section-head">
        <h2 id="nxe-compare-title">Compare networks</h2>
        <Segmented<CompareMetric>
          label="Comparison metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'projects', label: 'Projects' },
            { value: 'collections', label: 'Collections' },
            { value: 'tokens', label: 'Tokens' },
            { value: 'cap', label: 'Token cap' },
          ]}
        />
      </header>
      <ol className="nxe-compare__list">
        {rows.map((row) => {
          const value = metricValue(row, metric)
          const active = selected === row.network.id
          return (
            <li key={row.network.id}>
              <button type="button" aria-pressed={active} onClick={() => onSelect(active ? 'all' : row.network.id)} className={cn('nxe-bar', active && 'is-active')}>
                <span className="nxe-bar__name"><i style={{ background: row.network.color }} />{row.network.name}</span>
                <span className="nxe-bar__track" aria-hidden>
                  <motion.i style={{ background: row.network.color }} initial={{ width: 0 }} animate={{ width: `${Math.max((value / max) * 100, value ? 2 : 0)}%` }} transition={{ duration: 0.55, ease }} />
                </span>
                <span className="nxe-bar__v">{show(value)}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="nxe-note">Counts come from the demo catalogue; token cap is the sum of illustrative market caps.</p>
    </section>
  )
}
