import { useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { AtlasEntry, NetworkSelection } from '@/features/workspaces/ecosystems/atlas-data'

const W = 820
const H = 450
const CX = W / 2
const CY = H / 2 + 4
const RX = 304
const RY = 146

/**
 * Spatial network selector. Nodes sit on an orbit around the catalogue hub;
 * node size follows how much of the catalogue (projects + collections + tokens)
 * links to that network. L2 networks are drawn with a dashed outline.
 * The chip rail below is the equivalent control for touch and small screens.
 */
export function NetworkAtlas({ atlas, selected, onSelect }: { atlas: AtlasEntry[]; selected: NetworkSelection; onSelect: (id: NetworkSelection) => void }) {
  const nodes = useMemo(() => {
    const max = Math.max(...atlas.map((a) => a.activity), 1)
    return atlas.map((entry, i) => {
      const angle = (i / atlas.length) * Math.PI * 2 - Math.PI / 2
      return { entry, x: CX + Math.cos(angle) * RX, y: CY + Math.sin(angle) * RY, r: 22 + 20 * Math.sqrt(entry.activity / max) }
    })
  }, [atlas])

  const onKey = (id: NetworkSelection) => (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(id) }
  }

  return (
    <div className="nxe-atlas">
      <svg viewBox={`0 0 ${W} ${H}`} className="nxe-atlas__svg" role="group" aria-label="Network atlas. Choose a network to focus it.">
        <ellipse cx={CX} cy={CY} rx={RX} ry={RY} className="nxe-orbit" />
        <ellipse cx={CX} cy={CY} rx={RX * 0.58} ry={RY * 0.58} className="nxe-orbit nxe-orbit--inner" />
        {nodes.map(({ entry, x, y }) => {
          const active = selected === entry.network.id
          return (
            <line key={`s-${entry.network.id}`} x1={CX} y1={CY} x2={x} y2={y} stroke={entry.network.color} className={cn('nxe-spoke', active && 'is-active')} />
          )
        })}

        <g role="button" tabIndex={0} aria-pressed={selected === 'all'} aria-label="Show all networks" className="nxe-hub" onClick={() => onSelect('all')} onKeyDown={onKey('all')}>
          <circle cx={CX} cy={CY} r={36} className={cn('nxe-hub__disc', selected === 'all' && 'is-active')} />
          <text x={CX} y={CY - 2} textAnchor="middle" className="nxe-hub__t">ALL</text>
          <text x={CX} y={CY + 12} textAnchor="middle" className="nxe-hub__s">{atlas.length} networks</text>
        </g>

        {nodes.map(({ entry, x, y, r }) => {
          const { network } = entry
          const active = selected === network.id
          const dim = selected !== 'all' && !active
          return (
            <g
              key={network.id}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={`${network.name}: ${entry.projects.length} projects, ${entry.collections.length} collections, ${entry.tokens.length} tokens`}
              className={cn('nxe-node', active && 'is-active', dim && 'is-dim')}
              onClick={() => onSelect(active ? 'all' : network.id)}
              onKeyDown={onKey(active ? 'all' : network.id)}
            >
              {active ? <circle cx={x} cy={y} r={r + 8} fill="none" stroke={network.color} strokeOpacity={0.35} className="nxe-node__halo" /> : null}
              <circle cx={x} cy={y} r={r} fill={network.color} fillOpacity={active ? 0.3 : 0.16} stroke={network.color} strokeWidth={active ? 2 : 1.5} strokeDasharray={network.layer === 'L2' ? '4 3' : undefined} />
              <text x={x} y={y + 4} textAnchor="middle" className="nxe-node__tk">{network.shortName}</text>
              <text x={x} y={y + r + 15} textAnchor="middle" className="nxe-node__name">{network.name}</text>
              <text x={x} y={y + r + 28} textAnchor="middle" className="nxe-node__meta">{entry.projects.length} proj · {entry.collections.length} coll · {entry.tokens.length} tok</text>
            </g>
          )
        })}
      </svg>
      <p className="nxe-atlas__legend">
        <span><i className="nxe-key nxe-key--l1" /> L1</span>
        <span><i className="nxe-key nxe-key--l2" /> L2 (dashed)</span>
        <span>Node size = projects + collections + tokens in the catalogue</span>
      </p>
    </div>
  )
}

/** Touch-friendly selector: every network as a chip with its project count. */
export function NetworkRail({ atlas, selected, onSelect }: { atlas: AtlasEntry[]; selected: NetworkSelection; onSelect: (id: NetworkSelection) => void }) {
  return (
    <div className="nxe-rail" role="group" aria-label="Filter by network">
      <button type="button" aria-pressed={selected === 'all'} onClick={() => onSelect('all')} className={cn('nxe-chip', selected === 'all' && 'is-active')}>
        All <b>{atlas.reduce((s, a) => s + a.projects.length, 0)}</b>
      </button>
      {atlas.map((a) => {
        const active = selected === a.network.id
        return (
          <button key={a.network.id} type="button" aria-pressed={active} onClick={() => onSelect(active ? 'all' : a.network.id)} className={cn('nxe-chip', active && 'is-active')} style={{ ['--eco-accent' as string]: a.network.color }}>
            <i />{a.network.name} <b>{a.projects.length}</b>
          </button>
        )
      })}
    </div>
  )
}
