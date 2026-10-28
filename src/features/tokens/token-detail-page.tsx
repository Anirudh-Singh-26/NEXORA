import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, ChevronRight, Info, TrendingDown, TrendingUp } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChangeValue } from '@/components/shared/change-value'
import { CollectionCard } from '@/components/shared/collection-card'
import { EmptyState } from '@/components/shared/empty-state'
import { NetworkChip } from '@/components/shared/network-chip'
import { SectionHeader } from '@/components/shared/section-header'
import { Segmented } from '@/components/shared/segmented'
import { Sparkline } from '@/components/shared/sparkline'
import { TokenGlyph } from '@/components/shared/token-glyph'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import { Button } from '@/components/ui/button'
import { catalog } from '@/data/catalog'
import { getNetwork, getToken } from '@/data/selectors'
import { formatCompact, formatPercent, formatUsd, formatUsdCompact } from '@/lib/format'
import { ease, inView, rise, stagger, useMotionReduced } from '@/lib/motion'
import { cn } from '@/lib/utils'

type Window = '12' | '20' | '28'

export function TokenDetailPage() {
  const { id } = useParams()
  const token = id ? getToken(id) : undefined

  if (!token) {
    return (
      <EmptyState
        title="Token not in the demo book"
        body="That ticker is outside this prototype’s mock market."
        action={
          <Button asChild variant="outline">
            <Link to="/tokens">Back to tokens</Link>
          </Button>
        }
      />
    )
  }
  // Keyed so window selection resets when navigating between tokens.
  return <TokenDetail key={token.id} tokenId={token.id} />
}

function TokenDetail({ tokenId }: { tokenId: string }) {
  const token = getToken(tokenId)!
  const reduced = useMotionReduced()
  const [win, setWin] = useState<Window>('28')
  const network = getNetwork(token.networkId)
  const up = token.change24h >= 0
  const accent = up ? '#70d8b1' : '#fb7185'

  /** Rankings and shares across the whole demo book. */
  const book = useMemo(() => {
    const all = catalog.tokens
    const byCap = [...all].sort((a, b) => b.marketCap - a.marketCap)
    const byVol = [...all].sort((a, b) => b.volume24h - a.volume24h)
    const totalCap = all.reduce((s, t) => s + t.marketCap, 0)
    const ranked = byCap.findIndex((t) => t.id === token.id)
    return {
      total: all.length,
      capRank: ranked + 1,
      volRank: byVol.findIndex((t) => t.id === token.id) + 1,
      share: (token.marketCap / totalCap) * 100,
      prev: byCap[(ranked - 1 + byCap.length) % byCap.length],
      next: byCap[(ranked + 1) % byCap.length],
    }
  }, [token])

  /**
   * The catalogue stores a normalised trend index, not prices. Rescale it so the
   * final sample equals the quoted price — an illustrative path, not market history.
   */
  const series = useMemo(() => {
    const last = token.sparkline[token.sparkline.length - 1] || 1
    return token.sparkline.map((value, index) => ({ step: index + 1, price: (value / last) * token.price }))
  }, [token])

  const windowed = useMemo(() => series.slice(-Number(win)), [series, win])
  const stats = useMemo(() => {
    const prices = windowed.map((p) => p.price)
    const low = Math.min(...prices)
    const high = Math.max(...prices)
    const open = prices[0]
    const close = prices[prices.length - 1]
    return { low, high, open, close, delta: ((close - open) / open) * 100, position: high === low ? 50 : ((close - low) / (high - low)) * 100 }
  }, [windowed])

  const peers = useMemo(
    () => catalog.tokens.filter((t) => t.networkId === token.networkId && t.id !== token.id).sort((a, b) => b.marketCap - a.marketCap).slice(0, 5),
    [token],
  )
  const linked = catalog.collections.filter((c) => c.linkedTokenId === token.id)
  const sameNetwork = catalog.collections.filter((c) => c.networkId === token.networkId && c.linkedTokenId !== token.id)
  const related = [...linked, ...sameNetwork].slice(0, 3)

  const turnover = (token.volume24h / token.marketCap) * 100
  const impliedSupply = token.marketCap / token.price
  const gradId = `nx-detail-${token.id}`

  const metrics: { label: string; value: string; sub?: string }[] = [
    { label: 'Market cap', value: formatUsdCompact(token.marketCap), sub: `Rank ${book.capRank} of ${book.total}` },
    { label: '24h volume', value: formatUsdCompact(token.volume24h), sub: `Rank ${book.volRank} of ${book.total}` },
    { label: 'Turnover', value: `${turnover.toFixed(1)}%`, sub: 'Volume ÷ market cap' },
    { label: 'Book share', value: `${book.share.toFixed(book.share < 1 ? 2 : 1)}%`, sub: 'Of tracked demo cap' },
  ]

  return (
    <div className="space-y-8">
      {/* breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-mute">
        <Link to="/tokens" className="inline-flex items-center gap-1 transition-colors hover:text-ink"><ArrowLeft className="size-3.5" /> Tokens</Link>
        <ChevronRight className="size-3 opacity-50" />
        <span className="text-ink">{token.ticker}</span>
      </nav>

      {/* ── Identity ─────────────────────────────────────────── */}
      <motion.header {...inView} variants={stagger(0.06)} className="nx-hero relative overflow-hidden rounded-2xl border border-line/80 p-5 md:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full blur-3xl" style={{ background: `${accent}14` }} />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <motion.div variants={rise} className="flex items-start gap-4">
            <TokenGlyph token={token} className="size-14 rounded-xl text-[13px]" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <NetworkChip id={token.networkId} />
                <span className="nx-eyebrow rounded-full border border-line/80 px-2 py-0.5 text-[9.5px]">Cap rank #{book.capRank}</span>
                {token.demoNote ? <span className="nx-eyebrow text-[9.5px] text-copper">{token.demoNote}</span> : null}
              </div>
              <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-none tracking-[-0.04em]">
                {token.name} <span className="font-mono text-[0.45em] font-normal tracking-normal text-mute">{token.ticker}</span>
              </h1>
              <p className="mt-3 max-w-xl text-[13px] leading-6 text-mute">{token.description}</p>
            </div>
          </motion.div>
          <motion.div variants={rise} className="flex items-end justify-between gap-5 lg:flex-col lg:items-end">
            <div className="lg:text-right">
              <p className="nx-eyebrow text-[9.5px]">Demo quote</p>
              <p className="mt-1.5 font-mono text-[clamp(1.75rem,3vw,2.5rem)] leading-none tabular-nums">{formatUsd(token.price)}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[13px]">
                {up ? <TrendingUp className="size-4 text-gain" /> : <TrendingDown className="size-4 text-loss" />}
                <ChangeValue value={token.change24h} /> <span className="text-mute">24h</span>
              </p>
            </div>
            <WatchlistButton kind="token" id={token.id} />
          </motion.div>
        </div>
      </motion.header>

      {/* ── Chart + metrics ──────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section className="nx-panel rounded-xl p-4 md:p-5" aria-label="Illustrative price path">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="nx-eyebrow text-[9.5px]">Illustrative price path</p>
                <p className="mt-1.5 flex items-baseline gap-2 font-mono tabular-nums">
                  <span className="text-[20px]">{formatUsd(stats.close)}</span>
                  <span className={cn('text-[12px]', stats.delta >= 0 ? 'text-gain' : 'text-loss')}>{formatPercent(stats.delta)} over window</span>
                </p>
              </div>
              <Segmented<Window>
                label="Chart window"
                value={win}
                onChange={setWin}
                options={[
                  { value: '12', label: 'Short' },
                  { value: '20', label: 'Medium' },
                  { value: '28', label: 'Full' },
                ]}
              />
            </div>

            <div className="mt-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={windowed} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={accent} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(150,165,205,0.08)" vertical={false} />
                  <XAxis dataKey="step" hide />
                  <YAxis
                    orientation="right"
                    width={64}
                    domain={['dataMin', 'dataMax']}
                    tickCount={5}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#8f9bb8', fontSize: 10.5, fontFamily: 'ui-monospace, monospace' }}
                    tickFormatter={(v: number) => formatUsd(v)}
                  />
                  <ReferenceLine y={stats.open} stroke="rgba(143,155,184,0.45)" strokeDasharray="3 4" />
                  <Tooltip
                    cursor={{ stroke: 'rgba(169,154,255,0.4)', strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const point = payload[0].payload as { step: number; price: number }
                      return (
                        <div className="rounded-lg border border-line bg-raised/95 px-3 py-2 shadow-xl backdrop-blur">
                          <p className="font-mono text-[13px] tabular-nums">{formatUsd(point.price)}</p>
                          <p className={cn('font-mono text-[10.5px] tabular-nums', point.price >= stats.open ? 'text-gain' : 'text-loss')}>
                            {formatPercent(((point.price - stats.open) / stats.open) * 100)} vs window open
                          </p>
                          <p className="nx-eyebrow mt-1 text-[9px]">Sample {point.step} of {series.length}</p>
                        </div>
                      )
                    }}
                  />
                  <Area
                    key={win}
                    type="monotone"
                    dataKey="price"
                    stroke={accent}
                    strokeWidth={1.8}
                    fill={`url(#${gradId})`}
                    dot={false}
                    activeDot={{ r: 4, fill: accent, stroke: '#070912', strokeWidth: 2 }}
                    isAnimationActive={!reduced}
                    animationDuration={600}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* range position */}
            <div className="mt-4 grid items-center gap-3 border-t border-line/70 pt-4 sm:grid-cols-[auto_1fr_auto]">
              <div>
                <p className="nx-eyebrow text-[9.5px]">Window low</p>
                <p className="mt-1 font-mono text-[12.5px] tabular-nums">{formatUsd(stats.low)}</p>
              </div>
              <div className="relative h-1.5 rounded-full bg-line/60" role="img" aria-label={`Price sits ${Math.round(stats.position)}% of the way through the window range`}>
                <motion.span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas"
                  style={{ background: accent }}
                  initial={{ left: '0%' }}
                  animate={{ left: `${stats.position}%` }}
                  transition={{ duration: 0.7, ease }}
                />
              </div>
              <div className="sm:text-right">
                <p className="nx-eyebrow text-[9.5px]">Window high</p>
                <p className="mt-1 font-mono text-[12.5px] tabular-nums">{formatUsd(stats.high)}</p>
              </div>
            </div>
          </section>

          <motion.dl {...inView} variants={stagger(0.05)} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metrics.map((m) => (
              <motion.div key={m.label} variants={rise} className="nx-surface rounded-xl px-4 py-3.5">
                <dt className="nx-eyebrow text-[9.5px]">{m.label}</dt>
                <dd className="mt-2 font-mono text-[19px] leading-none tabular-nums">{m.value}</dd>
                {m.sub ? <p className="mt-2 text-[11px] text-mute">{m.sub}</p> : null}
              </motion.div>
            ))}
          </motion.dl>

          <p className="flex items-start gap-2 rounded-lg border border-dashed border-line/80 px-3.5 py-2.5 text-[11.5px] leading-5 text-mute">
            <Info className="mt-0.5 size-3.5 shrink-0 text-copper" />
            The path is generated from this prototype’s mock trend data and rescaled to the quoted price. It is not historical market data, and nothing here is live from chain.
          </p>
        </div>

        {/* ── Side column ────────────────────────────────────── */}
        <aside className="space-y-5 lg:sticky lg:top-[calc(var(--nx-topbar)+16px)] lg:self-start">
          <section className="nx-surface rounded-xl p-4">
            <h2 className="nx-eyebrow text-[9.5px]">Asset profile</h2>
            <dl className="mt-3 divide-y divide-line/60 text-[12.5px]">
              {[
                ['Network', network?.name ?? token.networkId],
                ['Network asset', network?.nativeSymbol ?? '—'],
                ['Implied supply', `${formatCompact(impliedSupply)} ${token.ticker}`],
                ['Market cap rank', `#${book.capRank}`],
                ['Linked collections', String(linked.length)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-mute">{label}</dt>
                  <dd className="text-right font-mono tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[10.5px] leading-4 text-mute/70">Implied supply = market cap ÷ quote. Derived from demo figures.</p>
          </section>

          <section className="nx-surface rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="nx-eyebrow text-[9.5px]">{peers.length ? `Also on ${network?.name}` : 'Network peers'}</h2>
            </div>
            {peers.length === 0 ? (
              <p className="mt-3 text-[12px] leading-5 text-mute">No other demo tokens share this network.</p>
            ) : (
              <ul className="mt-2 -mx-1.5">
                {peers.map((peer) => (
                  <li key={peer.id}>
                    <Link to={`/tokens/${peer.id}`} className="group flex items-center gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-inset/60">
                      <TokenGlyph token={peer} className="size-7" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium group-hover:text-copper">{peer.name}</span>
                        <span className="block font-mono text-[10.5px] tabular-nums text-mute">{formatUsd(peer.price)}</span>
                      </span>
                      <Sparkline data={peer.sparkline} positive={peer.change24h >= 0} className="h-6 w-14" />
                      <span className="w-14 text-right font-mono text-[11px]"><ChangeValue value={peer.change24h} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { t: book.prev, dir: 'prev' as const },
              { t: book.next, dir: 'next' as const },
            ].map(({ t, dir }) => (
              <Link
                key={dir}
                to={`/tokens/${t.id}`}
                className={cn('nx-surface nx-interactive group flex flex-col gap-1 rounded-xl px-3.5 py-3', dir === 'next' && 'items-end text-right')}
              >
                <span className="nx-eyebrow inline-flex items-center gap-1 text-[9px]">
                  {dir === 'prev' ? <ArrowLeft className="size-3" /> : null}
                  {dir === 'prev' ? 'Higher cap' : 'Lower cap'}
                  {dir === 'next' ? <ArrowRight className="size-3" /> : null}
                </span>
                <span className="text-[13px] font-medium group-hover:text-copper">{t.name}</span>
              </Link>
            ))}
          </div>
        </aside>
      </div>

      {/* ── Collections ──────────────────────────────────────── */}
      <section>
        <SectionHeader
          kicker="Ecosystem"
          title={linked.length ? `Collections tied to ${token.ticker}` : `Collections on ${network?.name ?? 'this network'}`}
          description={linked.length ? 'Collections quoted against this token, plus others on the same network.' : 'Same-network collections from the demo catalogue.'}
          href="/collections"
        />
        {related.length === 0 ? (
          <EmptyState title="No linked collections" body="This quote exists as market context only." />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {related.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
