import { Link } from 'react-router-dom'
import { ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight } from 'lucide-react'
import { NetworkChip } from '@/components/shared/network-chip'
import { Sparkline } from '@/components/shared/sparkline'
import { TokenGlyph } from '@/components/shared/token-glyph'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import type { TokenSort } from '@/data/selectors'
import type { Token } from '@/data/types'
import { formatPercent, formatUsd, formatUsdCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Dense directory table. Secondary columns drop away on narrow screens. */
export function TokenTable({ rows, totalCap, sort, ascending, onSort }: { rows: Token[]; totalCap: number; sort: TokenSort; ascending: boolean; onSort: (key: TokenSort) => void }) {
  const head = (label: string, key: TokenSort, className?: string) => (
    <th scope="col" className={className} aria-sort={sort === key ? (ascending ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(key)} className={cn('nxt-th', sort === key && 'is-active')}>
        {label}
        {sort === key ? ascending ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
      </button>
    </th>
  )
  const maxShare = Math.max(...rows.map((t) => t.marketCap / totalCap), 0.0001)

  return (
    <div className="nxt-tablewrap">
      <table className="nxt-table">
        <thead>
          <tr>
            <th scope="col" className="nxt-col-rank"><span className="nxt-th">#</span></th>
            {head('Asset', 'name', 'nxt-col-asset')}
            <th scope="col" className="nxt-col-net"><span className="nxt-th">Network</span></th>
            {head('Price', 'price', 'nxt-num')}
            {head('24h', 'change', 'nxt-num')}
            {head('Market cap', 'marketCap', 'nxt-num nxt-col-cap')}
            {head('Volume 24h', 'volume', 'nxt-num nxt-col-vol')}
            <th scope="col" className="nxt-col-trend"><span className="nxt-th">Trend</span></th>
            <th scope="col" className="nxt-col-watch"><span className="sr-only">Watch</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((token, index) => {
            const up = token.change24h >= 0
            const share = token.marketCap / totalCap
            return (
              <tr key={token.id}>
                <td className="nxt-col-rank nxt-rank">{String(index + 1).padStart(2, '0')}</td>
                <td className="nxt-col-asset">
                  <Link to={`/tokens/${token.id}`} className="nxt-asset">
                    <TokenGlyph token={token} className="size-8" />
                    <span>
                      <b>{token.ticker}</b>
                      <small>{token.name}{token.demoNote ? <em> · {token.demoNote}</em> : null}</small>
                    </span>
                  </Link>
                </td>
                <td className="nxt-col-net"><NetworkChip id={token.networkId} /></td>
                <td className="nxt-num">{formatUsd(token.price)}</td>
                <td className="nxt-num">
                  <span className={cn('nxt-delta', up ? 'is-up' : 'is-down')}>
                    {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {formatPercent(token.change24h)}
                  </span>
                </td>
                <td className="nxt-num nxt-col-cap">
                  <span>{formatUsdCompact(token.marketCap)}</span>
                  <span className="nxt-share" aria-hidden title={`${(share * 100).toFixed(2)}% of tracked cap`}><i style={{ width: `${Math.max((share / maxShare) * 100, 3)}%` }} /></span>
                </td>
                <td className="nxt-num nxt-col-vol">
                  <span>{formatUsdCompact(token.volume24h)}</span>
                  <small>{((token.volume24h / token.marketCap) * 100).toFixed(1)}% of cap</small>
                </td>
                <td className="nxt-col-trend"><Sparkline data={token.sparkline} positive={up} className="nxt-spark" /></td>
                <td className="nxt-col-watch"><WatchlistButton kind="token" id={token.id} compact /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
