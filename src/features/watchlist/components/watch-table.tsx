import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, Coins, Gem, Layers, Rocket } from 'lucide-react'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { NetworkChip } from '@/components/shared/network-chip'
import { Sparkline } from '@/components/shared/sparkline'
import { TokenGlyph } from '@/components/shared/token-glyph'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import { formatPercent } from '@/lib/format'
import { dur, ease } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { KIND_LABEL, type WatchKind, type WatchRow } from '@/features/watchlist/watchlist-model'

const KIND_ICON: Record<WatchKind, React.ReactNode> = { token: <Coins />, collection: <Layers />, asset: <Gem />, campaign: <Rocket /> }

function Thumb({ row }: { row: WatchRow }) {
  if (row.token) return <TokenGlyph token={row.token} className="nxw-thumb" />
  return <ArtworkFrame src={row.image ?? ''} alt="" fallbackLabel={row.name.slice(0, 2)} shade="none" parallax={false} sheen={false} className="nxw-thumb" />
}

function Movement({ row }: { row: WatchRow }) {
  if (row.change !== undefined) {
    const up = row.change >= 0
    return <span className={cn('nxw-move', up ? 'is-up' : 'is-down')}>{up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{formatPercent(row.change)}</span>
  }
  if (row.status) return <span className={cn('nxw-status', `is-${row.status}`)}>{row.status === 'live' ? <span className="nx-live-dot" /> : null}{row.status}</span>
  return <span className="nxw-dash" aria-label="No 24h change available">—</span>
}

/** One table for every saved type, so items can be compared at a glance. */
export function WatchTable({ rows }: { rows: WatchRow[] }) {
  return (
    <div className="nxw-table" role="table" aria-label="Saved items">
      <div className="nxw-row nxw-row--head" role="row">
        <span role="columnheader">Type</span>
        <span role="columnheader">Item</span>
        <span role="columnheader" className="nxw-hide-md">Network</span>
        <span role="columnheader" className="nxw-num">Value</span>
        <span role="columnheader" className="nxw-num">24h / status</span>
        <span role="columnheader" className="nxw-num nxw-hide-sm">Trend</span>
        <span role="columnheader" className="nxw-sr">Remove</span>
      </div>
      <ul className="nxw-body">
        {rows.map((row, index) => (
          <motion.li
            key={row.key}
            role="row"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur.base, ease, delay: Math.min(index, 8) * 0.025 }}
            className="nxw-row"
          >
            <span role="cell" className={cn('nxw-type', `is-${row.kind}`)}>{KIND_ICON[row.kind]}<span>{KIND_LABEL[row.kind]}</span></span>
            <span role="cell" className="nxw-item">
              <Thumb row={row} />
              <Link to={row.href} className="nxw-item__text">
                <b>{row.name}</b>
                <small>{row.sub}{row.note ? ` · ${row.note}` : ''}</small>
              </Link>
            </span>
            <span role="cell" className="nxw-hide-md">{row.networkId ? <NetworkChip id={row.networkId} /> : <span className="nxw-dash">—</span>}</span>
            <span role="cell" className="nxw-num nxw-value"><span>{row.value}</span><small>{row.valueLabel}</small></span>
            <span role="cell" className="nxw-num"><Movement row={row} /></span>
            <span role="cell" className="nxw-num nxw-hide-sm">{row.spark ? <Sparkline data={row.spark} positive={(row.change ?? 0) >= 0} className="nxw-spark" /> : null}</span>
            <span role="cell" className="nxw-act"><WatchlistButton kind={row.kind} id={row.id} compact className="size-8" /></span>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
