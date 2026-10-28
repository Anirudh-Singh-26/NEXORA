import { useMemo, useState } from 'react'
import { Activity, Layers3, TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Collection } from '@/data/types'
import { formatFloor } from '@/lib/format'

type Range = '24H' | '7D' | '30D'

export function CollectionInsights({ collection }: { collection: Collection }) {
  const [range, setRange] = useState<Range>('7D')
  const points = range === '24H' ? 24 : range === '7D' ? 28 : 30
  const series = useMemo(() => Array.from({ length: points }, (_, index) => {
    const progress = index / Math.max(1, points - 1)
    const wave = Math.sin(index * 0.77 + collection.floor * 2.1) * 0.035
    const drift = Math.cos(index * 0.29 + collection.volume24h / 100000) * 0.018
    return {
      label: range === '24H' ? `${String(index).padStart(2, '0')}:00` : range === '7D' ? `D${index + 1}` : `D${index + 1}`,
      floor: Math.max(collection.floor * 0.72, collection.floor * (0.92 + progress * 0.055 + wave + drift)),
      volume: Math.max(0, collection.volume24h * (0.48 + progress * 0.22 + Math.abs(wave) * 2.2)),
    }
  }), [collection.floor, collection.volume24h, points, range])

  const depth = useMemo(() => [0.4, 0.72, 1, 0.66, 0.36, 0.18].map((ratio, index) => ({
    label: `${(index * 0.25 + 0.75).toFixed(2)}×`,
    count: Math.max(1, Math.round(collection.items * ratio * 0.018)),
  })), [collection.items])
  const currentFloor = series[series.length - 1]?.floor ?? collection.floor

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-copper">Collection intelligence</p>
          <h2 className="mt-1 font-display text-2xl">Insights <span className="ml-1 align-middle text-[10px] font-sans font-normal uppercase tracking-wider text-mute">Demo data</span></h2>
        </div>
        <div className="inline-flex rounded-lg border border-line bg-raised p-0.5" aria-label="Chart time range">
          {(['24H', '7D', '30D'] as const).map((item) => (
            <button key={item} type="button" aria-pressed={range === item} onClick={() => setRange(item)} className={`rounded-md px-3 py-1.5 font-mono text-[10px] transition-colors ${range === item ? 'bg-inset text-ink' : 'text-mute hover:text-ink'}`}>{item}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(230px,.75fr)]">
        <div className="nx-panel min-w-0 rounded-xl p-4 md:p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-mute"><TrendingUp className="size-3.5 text-copper" /> Floor price trend</p>
              <p className="mt-1.5 font-mono text-2xl tabular-nums">{formatFloor(currentFloor, collection.floorSymbol)}</p>
            </div>
            <span className="rounded-md border border-line bg-canvas/60 px-2 py-1 text-[10px] text-mute">{range} · illustrative series</span>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`floor-${collection.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a99aff" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#a99aff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(145,160,198,.12)" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#7f8ba6', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis hide domain={['dataMin * 0.97', 'dataMax * 1.03']} />
                <Tooltip contentStyle={{ background: '#101524', border: '1px solid #303750', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#aeb8d0' }} formatter={(value) => [`${Number(value).toFixed(3)} ${collection.floorSymbol}`, 'Demo floor']} />
                <Area type="monotone" dataKey="floor" stroke="#a99aff" strokeWidth={2} fill={`url(#floor-${collection.id})`} activeDot={{ r: 3, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="nx-panel rounded-xl p-4">
            <p className="flex items-center gap-2 text-xs text-mute"><Layers3 className="size-3.5 text-sage" /> Listing depth illustration</p>
            <div className="mt-5 flex h-24 items-end gap-2">
              {depth.map((item) => <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="flex w-full flex-1 items-end"><div className="w-full rounded-t-sm bg-gradient-to-t from-[#4b9ca8] to-[#78d8df]" style={{ height: `${Math.max(12, Math.min(100, item.count / Math.max(...depth.map((point) => point.count)) * 100))}%`, opacity: 0.45 + item.count / Math.max(...depth.map((point) => point.count)) * 0.5 }} /></div><span className="font-mono text-[9px] text-mute">{item.label}</span></div>)}
            </div>
            <p className="mt-3 text-[10px] leading-4 text-mute">Illustrative listing distribution relative to the current floor.</p>
          </div>
          <div className="nx-panel rounded-xl p-4">
            <p className="flex items-center gap-2 text-xs text-mute"><Activity className="size-3.5 text-copper" /> Activity snapshot</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div><p className="font-mono text-xl tabular-nums">{Math.max(1, Math.round(collection.volume24h / 2400)).toLocaleString()}</p><p className="mt-1 text-[10px] text-mute">Demo volume units</p></div>
              <div><p className="font-mono text-xl tabular-nums">{Math.max(1, Math.round(collection.items * 0.013)).toLocaleString()}</p><p className="mt-1 text-[10px] text-mute">Illustrative listings</p></div>
            </div>
            <p className="mt-3 border-t border-line pt-3 text-[10px] leading-4 text-mute">These metrics are derived for this prototype, not blockchain activity.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
