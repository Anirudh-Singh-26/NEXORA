import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, CircleDot } from 'lucide-react'
import { TokenGlyph } from '@/components/shared/token-glyph'
import type { Token } from '@/data/types'
import { formatPercent, formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MarketPulse } from '@/features/tokens/market-pulse'
import '@/features/tokens/token-header.css'


/**
 * Market-terminal header: a precise title line with catalogue scope, then a
 * tape of the largest assets by market cap. Quotes are the illustrative
 * catalogue values and link to each token's detail page.
 */
export function TokenHeader({ tokens, pulse }: { tokens: Token[]; pulse: MarketPulse }) {
  const tape = useMemo(() => [...tokens].sort((a, b) => b.marketCap - a.marketCap).slice(0, 8), [tokens])
  const lead = pulse.nets[0]

  return (
    <header className="nxt-head">
      <div className="nxt-head__row">
        <div className="nxt-head__id">
          <p className="nxt-head__path"><span>Markets</span><i aria-hidden>/</i><span>Tokens</span></p>
          <h1 className="nxt-head__title">Token markets</h1>
        </div>
        <ul className="nxt-head__meta" aria-label="Catalogue scope">
          <li><b>{pulse.total}</b> assets</li>
          <li><b>{pulse.nets.length}</b> networks</li>
          {lead ? <li>Largest: <b>{lead.network.shortName}</b></li> : null}
          <li className="nxt-head__badge"><CircleDot className="size-3" /> Simulated snapshot</li>
        </ul>
      </div>
      <p className="nxt-head__note">Ranked demo quotes. Prices, caps and volumes are illustrative and do not update from chain.</p>

      <ul className="nxt-tape" aria-label="Largest assets by market cap">
        {tape.map((token, index) => {
          const up = token.change24h >= 0
          return (
            <li key={token.id}>
              <Link to={`/tokens/${token.id}`} className="nxt-tape__item">
                <span className="nxt-tape__rank">{index + 1}</span>
                <TokenGlyph token={token} className="size-5 rounded-md text-[8px]" />
                <b>{token.ticker}</b>
                <span className="nxt-tape__px">{formatUsd(token.price)}</span>
                <span className={cn('nxt-tape__ch', up ? 'is-up' : 'is-down')}>
                  {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {formatPercent(token.change24h)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </header>
  )
}

/** Hairline label that names a zone of the page (overview vs directory). */
export function ZoneLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="nxt-zone">
      <span>{title}</span>
      {hint ? <em>{hint}</em> : null}
    </div>
  )
}
