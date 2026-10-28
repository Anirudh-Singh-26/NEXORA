import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkline } from '@/components/shared/sparkline'
import { WatchlistButton } from '@/components/shared/watchlist-button'
import { getNetwork } from '@/data/selectors'
import type { Token } from '@/data/types'
import { formatPercent, formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'

type Rect = { x: number; y: number; w: number; h: number }

/** Squarified treemap (Bruls et al.) laid out in a W×H unit box. */
function squarify<T>(entries: { item: T; value: number }[], bounds: Rect): (Rect & { item: T })[] {
  const sorted = [...entries].sort((a, b) => b.value - a.value)
  const total = sorted.reduce((s, e) => s + e.value, 0)
  if (!total) return []
  const scale = (bounds.w * bounds.h) / total
  const out: (Rect & { item: T })[] = []
  let rect = { ...bounds }
  let row: typeof sorted = []

  const sum = (r: typeof sorted) => r.reduce((s, e) => s + e.value * scale, 0)
  const worst = (r: typeof sorted, side: number) => {
    const areas = r.map((e) => e.value * scale)
    const s = areas.reduce((a, b) => a + b, 0)
    return Math.max((side * side * Math.max(...areas)) / (s * s), (s * s) / (side * side * Math.min(...areas)))
  }
  const flush = () => {
    const s = sum(row)
    if (rect.w >= rect.h) {
      const cw = s / rect.h
      let y = rect.y
      for (const e of row) {
        const h = (e.value * scale) / cw
        out.push({ x: rect.x, y, w: cw, h, item: e.item })
        y += h
      }
      rect = { x: rect.x + cw, y: rect.y, w: rect.w - cw, h: rect.h }
    } else {
      const rh = s / rect.w
      let x = rect.x
      for (const e of row) {
        const w = (e.value * scale) / rh
        out.push({ x, y: rect.y, w, h: rh, item: e.item })
        x += w
      }
      rect = { x: rect.x, y: rect.y + rh, w: rect.w, h: rect.h - rh }
    }
    row = []
  }
  for (const entry of sorted) {
    const side = Math.min(rect.w, rect.h)
    if (row.length === 0 || worst([...row, entry], side) <= worst(row, side)) row.push(entry)
    else { flush(); row = [entry] }
  }
  if (row.length) flush()
  return out
}

function tint(change: number) {
  const k = Math.min(Math.abs(change) / 8, 1)
  const rgb = change >= 0 ? '56,189,140' : '244,87,115'
  return { background: `linear-gradient(160deg, rgba(${rgb},${0.2 + k * 0.5}), rgba(${rgb},${0.1 + k * 0.28}))`, borderColor: `rgba(${rgb},${0.35 + k * 0.4})` }
}

/**
 * Heat map view: tile area follows √market cap (so the largest asset does not
 * flatten everything else) and colour follows 24h change.
 */
export function TokenHeatmap({ rows }: { rows: Token[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(960)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth || 960)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const wide = width >= 640
  const W = 100
  const H = wide ? 40 : 118
  const tiles = squarify(rows.map((t) => ({ item: t, value: Math.sqrt(Math.max(t.marketCap, 1)) })), { x: 0, y: 0, w: W, h: H })

  return (
    <div className="nxt-heat">
      <div ref={ref} className="nxt-heat__map" style={{ aspectRatio: `${W} / ${H}` }}>
        {tiles.map(({ item: token, x, y, w, h }) => {
          // Pixel size drives how much a tile can say.
          const pw = (w / W) * width
          const ph = (h / H) * (width * (H / W))
          const showPrice = pw > 120 && ph > 78
          const showSpark = pw > 150 && ph > 110
          const showWatch = pw > 130 && ph > 70
          const up = token.change24h >= 0
          return (
            <div key={token.id} className="nxt-tile-wrap" style={{ left: `${x}%`, top: `${(y / H) * 100}%`, width: `${w}%`, height: `${(h / H) * 100}%` }}>
              <Link
                to={`/tokens/${token.id}`}
                style={tint(token.change24h)}
                className={cn('nxt-tile', pw < 70 && 'is-tiny')}
                aria-label={`${token.name}, ${formatPercent(token.change24h)} in 24 hours`}
                title={`${token.name} · ${getNetwork(token.networkId)?.shortName ?? ''}`}
              >
                <span className="nxt-tile__tk">{token.ticker}</span>
                <span className={cn('nxt-tile__ch', up ? 'is-up' : 'is-down')}>{up ? '▲' : '▼'} {formatPercent(token.change24h)}</span>
                {showPrice ? <span className="nxt-tile__px">{formatUsd(token.price)}</span> : null}
                {showSpark ? <Sparkline data={token.sparkline} positive={up} className="nxt-tile__spark" /> : null}
              </Link>
              {showWatch ? <WatchlistButton kind="token" id={token.id} compact className="nxt-tile__watch" /> : null}
            </div>
          )
        })}
      </div>
      <p className="nxt-heat__legend">
        <span>Tile area ∝ √ market cap</span>
        <span className="nxt-heat__scale" aria-hidden><i className="is-down" /> −8% <b /> +8% <i className="is-up" /></span>
        <span>Colour = 24h change · tiles too small for a watch button are in the table view</span>
      </p>
    </div>
  )
}
