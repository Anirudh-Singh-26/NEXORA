import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Sparkline } from '@/components/shared/sparkline'
import { AnimatedValue } from '@/components/shared/animated-value'
import { TokenGlyph } from '@/components/shared/token-glyph'
import type { NetworkId, Token } from '@/data/types'
import { formatPercent } from '@/lib/format'
import { ease } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { MarketPulse } from '@/features/tokens/market-pulse'

function Panel({ index, title, hint, children, className }: { index: string; title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('nxt-panel', className)} aria-label={title}>
      <header className="nxt-panel__head">
        <span className="nxt-panel__idx">{index}</span>
        <h2>{title}</h2>
        {hint ? <span className="nxt-panel__hint">{hint}</span> : null}
      </header>
      {children}
    </section>
  )
}

function MoverRow({ token, tone }: { token: Token; tone: 'up' | 'down' }) {
  return (
    <li>
      <Link to={`/tokens/${token.id}`} className="nxt-mover">
        <TokenGlyph token={token} className="size-6 rounded-md text-[9px]" />
        <span className="nxt-mover__id"><b>{token.ticker}</b><small>{token.name}</small></span>
        <Sparkline data={token.sparkline} positive={tone === 'up'} className="nxt-mover__spark" />
        <span className={cn('nxt-delta', tone === 'up' ? 'is-up' : 'is-down')}>
          {tone === 'up' ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {formatPercent(token.change24h)}
        </span>
      </Link>
    </li>
  )
}

export function MarketOverview({ pulse, network, onNetwork }: { pulse: MarketPulse; network: NetworkId | 'all'; onNetwork: (id: NetworkId | 'all') => void }) {
  const maxBucket = Math.max(...pulse.buckets.map((b) => b.count), 1)
  const maxNet = Math.max(...pulse.nets.map((n) => n.cap), 1)
  const turnover = pulse.totalCap ? (pulse.totalVol / pulse.totalCap) * 100 : 0

  return (
    <div className="nxt-overview">
      {/* Market-wide indicators: one instrument strip, not a row of cards */}
      <dl className="nxt-strip" aria-label="Market indicators">
        <div className="nxt-strip__cell">
          <dt>Tracked market cap</dt>
          <dd><AnimatedValue value={pulse.totalCap} format="usdCompact" /></dd>
          <p><AnimatedValue value={pulse.total} /> catalogue assets</p>
        </div>
        <div className="nxt-strip__cell">
          <dt>24h volume</dt>
          <dd><AnimatedValue value={pulse.totalVol} format="usdCompact" /></dd>
          <p><AnimatedValue value={turnover} format="decimal1" /> of cap</p>
        </div>
        <div className="nxt-strip__cell">
          <dt>Cap-weighted 24h</dt>
          <dd className={pulse.weighted >= 0 ? 'is-up' : 'is-down'}><AnimatedValue value={pulse.weighted} format="percent" /></dd>
          <p>weighted by market cap</p>
        </div>
        <div className="nxt-strip__cell">
          <dt>Breadth</dt>
          <dd><span className="is-up"><AnimatedValue value={pulse.up} /></span><span className="nxt-strip__sep">/</span><span className="is-down"><AnimatedValue value={pulse.down} /></span></dd>
          <div className="nxt-breadth" role="img" aria-label={`${pulse.up} of ${pulse.total} tokens up in the last 24 hours`}>
            <motion.i className="is-up" initial={{ width: 0 }} animate={{ width: `${(pulse.up / pulse.total) * 100}%` }} transition={{ duration: 0.7, ease }} />
            <i className="is-down" />
          </div>
        </div>
      </dl>

      <div className="nxt-panels">
        <Panel index="01" title="Movers" hint="24h" className="nxt-panel--movers">
          <div className="nxt-movers">
            <div>
              <p className="nxt-sub is-up">Gainers</p>
              <ul>{pulse.gainers.length ? pulse.gainers.map((t) => <MoverRow key={t.id} token={t} tone="up" />) : <li className="nxt-none">None</li>}</ul>
            </div>
            <div>
              <p className="nxt-sub is-down">Losers</p>
              <ul>{pulse.losers.length ? pulse.losers.map((t) => <MoverRow key={t.id} token={t} tone="down" />) : <li className="nxt-none">None</li>}</ul>
            </div>
          </div>
        </Panel>

        <Panel index="02" title="24h distribution" hint="tokens per bucket (%)">
          <div className="nxt-hist" role="img" aria-label="Distribution of 24 hour price changes across tracked tokens">
            {pulse.buckets.map((b) => (
              <div key={b.label} className="nxt-hist__col">
                <span className="nxt-hist__n">{b.count}</span>
                <span className="nxt-hist__bar"><motion.i className={b.tone === 'up' ? 'is-up' : 'is-down'} initial={{ height: 0 }} animate={{ height: `${(b.count / maxBucket) * 100}%` }} transition={{ duration: 0.6, ease }} /></span>
                <span className="nxt-hist__l">{b.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel index="03" title="Cap by network" hint="click to filter">
          <ul className="nxt-nets">
            {pulse.nets.map((n) => {
              const active = network === n.network.id
              return (
                <li key={n.network.id}>
                  <button type="button" aria-pressed={active} onClick={() => onNetwork(active ? 'all' : n.network.id)} className={cn('nxt-net', active && 'is-active')}>
                    <span className="nxt-net__name"><i style={{ background: n.network.color }} />{n.network.shortName}</span>
                    <span className="nxt-net__bar"><motion.i style={{ background: n.network.color }} initial={{ width: 0 }} animate={{ width: `${(n.cap / maxNet) * 100}%` }} transition={{ duration: 0.7, ease }} /></span>
                    <span className="nxt-net__pct">{((n.cap / pulse.totalCap) * 100).toFixed(1)}%</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
