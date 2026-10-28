import type { CollectionTraits, IntervalStats } from '@/lib/nft-data/collection-detail'
import { fmtCount, fmtVolume, NO_VALUE } from '@/lib/nft-data/format'
import type { Amount } from '@/lib/nft-data/types'

/** Signed difference with its unit, e.g. "+12.3 ETH"; unknown → "—". */
const fmtDiffAmount = (a: Amount | null) => (a ? `${a.value > 0 ? '+' : ''}${fmtVolume(a)}` : NO_VALUE)
const fmtDiffCount = (n: number | null) => (n === null ? NO_VALUE : `${n > 0 ? '+' : ''}${fmtCount(n)}`)
const diffTone = (n: number | null) => (n === null || n === 0 ? '' : n > 0 ? 'text-gain' : 'text-loss')

export function IntervalTable({ rows }: { rows: [string, IntervalStats | null][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-line/70">
            {['Period', 'Volume', 'Volume vs previous', 'Sales', 'Sales vs previous', 'Avg. price'].map((h, i) => (
              <th key={h} scope="col" className={`nx-eyebrow px-3 py-2.5 text-[9.5px] font-normal ${i === 0 ? '' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, iv]) => (
            <tr key={label} className="border-b border-line/60 last:border-0">
              <th scope="row" className="px-3 py-2.5 font-medium">{label}</th>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtVolume(iv?.volume ?? null)}</td>
              <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${diffTone(iv?.volumeDiff?.value ?? null)}`}>{fmtDiffAmount(iv?.volumeDiff ?? null)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtCount(iv?.sales ?? null)}</td>
              <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${diffTone(iv?.salesDiff ?? null)}`}>{fmtDiffCount(iv?.salesDiff ?? null)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtVolume(iv?.averagePrice ?? null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TraitGrid({ traits }: { traits: CollectionTraits }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {traits.categories.map((cat) => {
          const max = Math.max(1, ...cat.values.map((v) => v.count))
          return (
            <div key={cat.name} className="nx-surface rounded-xl p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-[13px] font-medium capitalize" title={cat.name}>{cat.name}</p>
                <p className="shrink-0 text-[10.5px] text-mute">{cat.distinctValues.toLocaleString('en-US')} value{cat.distinctValues === 1 ? '' : 's'}</p>
              </div>
              <ul className="mt-3 space-y-2">
                {cat.values.map((v) => (
                  <li key={v.value}>
                    <div className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="min-w-0 truncate" title={v.value}>{v.value}</span>
                      <span className="shrink-0 font-mono tabular-nums text-mute">{v.count.toLocaleString('en-US')}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-inset" aria-hidden>
                      <div className="h-full rounded-full bg-gradient-to-r from-copper/70 to-sage/80" style={{ width: `${Math.max((v.count / max) * 100, 2)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              {cat.distinctValues > cat.values.length ? <p className="mt-2.5 text-[10.5px] text-mute">Showing the {cat.values.length} most common of {cat.distinctValues.toLocaleString('en-US')}.</p> : null}
            </div>
          )
        })}
      </div>
      {traits.totalCategories > traits.categories.length ? <p className="text-[11px] text-mute">Showing {traits.categories.length} of {traits.totalCategories} trait categories.</p> : null}
    </div>
  )
}
