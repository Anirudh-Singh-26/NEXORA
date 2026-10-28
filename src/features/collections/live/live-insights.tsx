import { useState } from 'react'
import { Activity, Layers3, TrendingUp } from 'lucide-react'
import { Segmented } from '@/components/shared/segmented'
import { Note } from '@/features/collections/live/live-ui'
import type { CollectionStats, IntervalStats } from '@/lib/nft-data/collection-detail'
import { listingDepth } from '@/lib/nft-data/collection-extras'
import { fmtCount, fmtVolume, NO_VALUE } from '@/lib/nft-data/format'
import type { Amount } from '@/lib/nft-data/types'

type Range = '24H' | '7D' | '30D'
const RANGE_LABEL: Record<Range, string> = { '24H': 'last 24 hours', '7D': 'last 7 days', '30D': 'last 30 days' }

/** Current vs previous value as two proportional bars. Both must be known; otherwise the caller shows "—". */
function Compare({ title, current, previous, format }: { title: string; current: number | null; previous: number | null; format: (n: number) => string }) {
  const max = Math.max(current ?? 0, previous ?? 0, Number.EPSILON)
  const rows: [string, number | null, string][] = [['This period', current, 'from-copper/80 to-sage/80'], ['Previous period', previous, 'from-mute/50 to-mute/30']]
  return (
    <div className="space-y-2.5">
      <p className="text-[13px] font-medium">{title}</p>
      {rows.map(([label, value, tone]) => (
        <div key={label}>
          <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
            <span className="text-mute">{label}</span>
            <span className="font-mono tabular-nums">{value === null ? NO_VALUE : format(value)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-inset" aria-hidden>
            <div className={`h-full rounded-full bg-gradient-to-r ${tone}`} style={{ width: value === null ? '0%' : `${Math.max((value / max) * 100, value > 0 ? 2 : 0)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function previousOf(current: number | null, diff: number | null): number | null {
  if (current === null || diff === null) return null
  const prev = current - diff
  return prev >= 0 ? prev : null
}

/**
 * Real insights only. Period comparisons come from OpenSea's interval stats (previous = current − reported change);
 * the depth chart is built from the cheapest active listings in the loaded sample. OpenSea's API has no price
 * history, so there is deliberately no floor-price trend line for live collections.
 */
export function LiveInsights({ stats, listings }: { stats: CollectionStats | null; listings: Record<string, Amount> }) {
  const [range, setRange] = useState<Range>('7D')
  const iv: IntervalStats | null = stats ? (range === '24H' ? stats.intervals.oneDay : range === '7D' ? stats.intervals.sevenDay : stats.intervals.thirtyDay) : null
  const depth = listingDepth(listings)
  const maxDepth = depth ? Math.max(1, ...depth.buckets.map((b) => b.count)) : 1
  const volSym = iv?.volume?.symbol ?? ''
  const unit = (n: number) => fmtVolume({ value: n, symbol: volSym })

  return (
    <section aria-label="Collection insights" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-copper">Collection intelligence</p>
          <h2 className="mt-1 font-display text-2xl">Insights <span className="ml-1 align-middle font-sans text-[10px] font-normal uppercase tracking-wider text-mute">Live data</span></h2>
        </div>
        <Segmented<Range> label="Insight period" value={range} onChange={setRange} options={[{ value: '24H', label: '24H' }, { value: '7D', label: '7D' }, { value: '30D', label: '30D' }]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="nx-surface rounded-xl p-4 md:p-5">
          <p className="flex items-center gap-2 text-[12px] text-mute"><TrendingUp className="size-4" aria-hidden />Market activity, {RANGE_LABEL[range]} vs the period before</p>
          {iv ? (
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <Compare title="Volume" current={iv.volume?.value ?? null} previous={previousOf(iv.volume?.value ?? null, iv.volumeDiff?.value ?? null)} format={unit} />
              <Compare title="Sales" current={iv.sales} previous={previousOf(iv.sales, iv.salesDiff)} format={(n) => fmtCount(n)} />
              <div className="sm:col-span-2 border-t border-line/60 pt-3 text-[12px] text-mute">
                Average sale price <span className="ml-1 font-mono text-ink tabular-nums">{fmtVolume(iv.averagePrice)}</span>
              </div>
            </div>
          ) : (
            <div className="mt-4"><Note>OpenSea did not supply statistics for this period.</Note></div>
          )}
          <p className="mt-4 text-[10.5px] leading-5 text-mute">No floor-price history chart: OpenSea’s API does not provide historical floor prices, and NEXORA does not draw invented ones.</p>
        </div>

        <div className="nx-surface rounded-xl p-4 md:p-5">
          <p className="flex items-center gap-2 text-[12px] text-mute"><Layers3 className="size-4" aria-hidden />Listing depth (cheapest listings)</p>
          {depth ? (
            <>
              <div className="mt-4 flex h-32 items-end gap-2" role="img" aria-label={`Distribution of the ${depth.total} cheapest listings relative to the lowest listing`}>
                {depth.buckets.map((b) => (
                  <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="font-mono text-[10px] tabular-nums text-mute">{b.count}</span>
                    <div className="w-full rounded-t-md bg-gradient-to-t from-copper/50 to-sage/70" style={{ height: `${Math.max((b.count / maxDepth) * 88, b.count ? 4 : 1)}px` }} />
                    <span className="font-mono text-[9.5px] text-mute">{b.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10.5px] leading-5 text-mute">{depth.total} cheapest active listings priced in {depth.symbol}, grouped by price relative to the lowest one. A sample from OpenSea, not the full order book.</p>
            </>
          ) : (
            <div className="mt-4"><Note>Not enough priced listings were returned to draw a depth chart.</Note></div>
          )}
          <p className="mt-4 flex items-center gap-2 border-t border-line/60 pt-3 text-[12px] text-mute"><Activity className="size-4" aria-hidden />Sales {RANGE_LABEL[range]} <span className="ml-auto font-mono text-ink tabular-nums">{fmtCount(iv?.sales ?? null)}</span></p>
        </div>
      </div>
    </section>
  )
}
