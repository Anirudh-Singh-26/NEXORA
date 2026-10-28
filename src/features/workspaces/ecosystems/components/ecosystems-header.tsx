import { useMemo } from 'react'
import { ArrowDown } from 'lucide-react'
import { AnimatedValue } from '@/components/shared/animated-value'
import type { AtlasEntry } from '@/features/workspaces/ecosystems/atlas-data'
import '@/features/workspaces/ecosystems/ecosystems-header.css'

const W = 360
const H = 220
const CX = W / 2
const CY = H / 2
const R_INNER = 56
const R_OUTER = 96

/** Evenly spaced angles for `count` nodes, offset so rings do not align. */
function place(count: number, radius: number, offset: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / Math.max(count, 1)) * Math.PI * 2 + offset
    return { x: CX + Math.cos(a) * radius * 1.35, y: CY + Math.sin(a) * radius * 0.78 }
  })
}

/**
 * Network-explorer header. The motif is a decorative constellation of the real
 * networks (L1 on the inner ring, L2 on the outer ring, size by linked catalogue
 * records). The figures beside it are counted from the atlas data. Selection
 * lives in the atlas below, so the motif itself is not interactive.
 */
export function EcosystemsHeader({ atlas }: { atlas: AtlasEntry[] }) {
  const figures = useMemo(() => {
    const l1 = atlas.filter((a) => a.network.layer !== 'L2')
    const l2 = atlas.filter((a) => a.network.layer === 'L2')
    const lead = [...atlas].sort((a, b) => b.activity - a.activity)[0]
    return {
      l1,
      l2,
      lead,
      projects: atlas.reduce((s, a) => s + a.projects.length, 0),
      collections: atlas.reduce((s, a) => s + a.collections.length, 0),
      tokens: atlas.reduce((s, a) => s + a.tokens.length, 0),
    }
  }, [atlas])

  const nodes = useMemo(() => {
    const max = Math.max(...atlas.map((a) => a.activity), 1)
    const inner = place(figures.l1.length, R_INNER, -Math.PI / 2)
    const outer = place(figures.l2.length, R_OUTER, -Math.PI / 2 + Math.PI / Math.max(figures.l2.length, 1))
    const size = (e: AtlasEntry) => 5 + 7 * Math.sqrt(e.activity / max)
    return [
      ...figures.l1.map((entry, i) => ({ entry, ...inner[i], r: size(entry) })),
      ...figures.l2.map((entry, i) => ({ entry, ...outer[i], r: size(entry) })),
    ]
  }, [atlas, figures])

  return (
    <header className="nxe-head">
      <div className="nxe-head__copy">
        <p className="nx-kicker">Blockchain explorer</p>
        <h1 className="nxe-head__title">Ecosystems</h1>
        <p className="nxe-head__deck">See which networks the catalogue spans and how many projects, collections and tokens sit on each, then open a network to explore what lives there.</p>

        <dl className="nxe-head__figures" aria-label="Catalogue network summary">
          <div><dt>Networks</dt><dd><AnimatedValue value={atlas.length} /></dd><small><AnimatedValue value={figures.l1.length} /> L1 · <AnimatedValue value={figures.l2.length} /> L2</small></div>
          <div><dt>Projects</dt><dd><AnimatedValue value={figures.projects} /></dd></div>
          <div><dt>Collections</dt><dd><AnimatedValue value={figures.collections} /></dd></div>
          <div><dt>Tokens</dt><dd><AnimatedValue value={figures.tokens} /></dd></div>
          {figures.lead ? <div className="nxe-head__lead"><dt>Most linked</dt><dd>{figures.lead.network.name}</dd><small><AnimatedValue value={figures.lead.activity} /> catalogue records</small></div> : null}
        </dl>
        <p className="nxe-head__pill"><span aria-hidden /> Demo environment · sample data</p>
      </div>

      <figure className="nxe-head__motif" aria-hidden>
        <svg viewBox={`0 0 ${W} ${H}`} className="nxe-head__svg" focusable="false">
          <ellipse cx={CX} cy={CY} rx={R_INNER * 1.35} ry={R_INNER * 0.78} className="nxe-head__ring" />
          <ellipse cx={CX} cy={CY} rx={R_OUTER * 1.35} ry={R_OUTER * 0.78} className="nxe-head__ring nxe-head__ring--outer" />
          {nodes.map(({ entry, x, y }) => (
            <line key={`l-${entry.network.id}`} x1={CX} y1={CY} x2={x} y2={y} stroke={entry.network.color} className="nxe-head__spoke" />
          ))}
          <circle cx={CX} cy={CY} r={7} className="nxe-head__hub" />
          {nodes.map(({ entry, x, y, r }) => (
            <g key={entry.network.id}>
              <circle cx={x} cy={y} r={r + 5} fill={entry.network.color} fillOpacity={0.1} />
              <circle cx={x} cy={y} r={r} fill={entry.network.color} fillOpacity={0.35} stroke={entry.network.color} strokeWidth={1.5} strokeDasharray={entry.network.layer === 'L2' ? '3 2' : undefined} />
            </g>
          ))}
        </svg>
      </figure>
    </header>
  )
}

/** Hand-off from the introduction to the interactive atlas. */
export function AtlasRule() {
  return (
    <div className="nxe-rule">
      <span><ArrowDown className="size-3" aria-hidden /> Network atlas</span>
      <em>Select a network to focus its projects, collections and tokens</em>
    </div>
  )
}
