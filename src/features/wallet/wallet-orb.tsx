import { useEffect, useMemo, useRef, useState } from 'react'
import { useMotionReduced } from '@/lib/motion'
import {
  assignAngles, glyphOf, identityHues, BRAND_HUES, ORB_SIZE, project, RING_ORDER, RINGS, ringOutline, ringPoint, rotateView, splitOutline,
  type OrbNode, type RingId,
} from '@/lib/wallet/orb-model'
import { identityGradient } from '@/features/wallet/wallet-utils'

const BASE_PITCH = -0.42
const BASE_YAW = 0.18
const TICKS = 72

interface WalletOrbProps {
  /** Public address the colours derive from; null renders the brand-coloured dormant orb. */
  seed: string | null
  /** Short glyph in the core ("Ξ", "◎"). */
  glyph: string
  /** Core caption, e.g. the network name. */
  caption: string
  /** Secondary core caption. */
  captionSub: string | null
  nodes: OrbNode[]
  /** Plain-language summary for assistive tech; the orb itself is decorative. */
  summary: string
  onSelectNode?: (node: OrbNode) => void
  onSelectRing?: (ring: RingId) => void
}

function NodeFace({ node }: { node: OrbNode }) {
  const [failed, setFailed] = useState(false)
  if (node.image && !failed) {
    return <img src={node.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(true)} />
  }
  if (node.kind === 'network') return <span className="wlt-orb__dot" />
  return <span className="wlt-orb__glyph" style={{ background: identityGradient(node.seed) }}>{glyphOf(node.label, '?')}</span>
}

/**
 * The wallet's signature visual: a lit core in the wallet's own colours, ringed by orbits that carry what is actually
 * loaded: tokens on the inner ring, NFTs on the middle ring, networks on the outer ring. Positions are projected in JS
 * (true perspective, depth-sorted), so nothing depends on CSS 3D support. It leans toward the pointer, pauses when off
 * screen or in a hidden tab, and renders one still frame under reduced motion. It is decorative: the same information is
 * in the lists, and the whole figure is hidden from assistive tech apart from a one-line summary.
 */
export function WalletOrb({ seed, glyph, caption, captionSub, nodes, summary, onSelectNode, onSelectRing }: WalletOrbProps) {
  const reduce = useMotionReduced()
  const rootRef = useRef<HTMLDivElement>(null)
  const backRefs = useRef<Partial<Record<RingId, SVGPathElement | null>>>({})
  const frontRefs = useRef<Partial<Record<RingId, SVGPathElement | null>>>({})
  const nodeRefs = useRef<Map<string, HTMLSpanElement>>(new Map())
  const [hovered, setHovered] = useState<OrbNode | null>(null)
  const hues = seed ? identityHues(seed) : BRAND_HUES
  const angles = useMemo(() => assignAngles(nodes), [nodes])
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const anglesRef = useRef(angles)
  anglesRef.current = angles

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let raf = 0
    let running = false
    let visible = true
    let size = root.clientWidth || ORB_SIZE
    let start = performance.now()
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, dragX: 0, dragY: 0, isDragging: false }
    let lastPointerX = 0
    let lastPointerY = 0

    const draw = (now: number) => {
      const t = reduce ? 0 : (now - start) / 1000
      pointer.x += (pointer.tx - pointer.x) * 0.08
      pointer.y += (pointer.ty - pointer.y) * 0.08
      const yaw = BASE_YAW + (pointer.x + pointer.dragX) * 0.5
      const pitch = Math.max(-1.1, Math.min(0.4, BASE_PITCH + (pointer.y + pointer.dragY) * 0.35))
      const k = size / ORB_SIZE
      for (const id of RING_ORDER) {
        const ring = RINGS[id]
        const { front, back } = splitOutline(ringOutline(ring, yaw, pitch, 96, t * ring.speed))
        backRefs.current[id]?.setAttribute('d', back)
        frontRefs.current[id]?.setAttribute('d', front)
      }
      for (const node of nodesRef.current) {
        const el = nodeRefs.current.get(node.id)
        const angle = anglesRef.current.get(node.id)
        if (!el || angle === undefined) continue
        const ring = RINGS[node.ring]
        const p = project(rotateView(ringPoint(ring, angle + t * ring.speed), yaw, pitch))
        const depth = (p.z / ring.radius + 1) / 2 // 0 far … 1 near
        const baseScale = node.kind === 'network' ? (node.active ? 1.18 : 0.82) : 1
        el.style.transform = `translate3d(${(p.x * k).toFixed(1)}px, ${(p.y * k).toFixed(1)}px, 0) translate(-50%, -50%) scale(${(p.scale * baseScale * k).toFixed(3)})`
        el.style.opacity = String(node.kind === 'network' && !node.active ? 0.35 + depth * 0.5 : 0.45 + depth * 0.55)
        el.style.zIndex = p.z < 0 ? '2' : '4'
      }
    }

    const loop = (now: number) => {
      draw(now)
      raf = requestAnimationFrame(loop)
    }
    const play = () => {
      if (reduce || running || !visible || document.hidden) return
      running = true
      raf = requestAnimationFrame(loop)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }
    const still = () => draw(performance.now())

    const resize = new ResizeObserver(() => {
      size = root.clientWidth || ORB_SIZE
      if (!running) still()
    })
    resize.observe(root)

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) play()
      else stop()
    })
    io.observe(root)

    const onVisibility = () => (document.hidden ? stop() : play())
    document.addEventListener('visibilitychange', onVisibility)

    const onMove = (event: PointerEvent) => {
      if (reduce) return
      const rect = root.getBoundingClientRect()
      if (pointer.isDragging) {
        const dx = (event.clientX - lastPointerX) / (rect.width * 0.5)
        const dy = (event.clientY - lastPointerY) / (rect.height * 0.5)
        pointer.dragX += dx * 1.6
        pointer.dragY += dy * 1.6
        lastPointerX = event.clientX
        lastPointerY = event.clientY
        if (!running) still()
      } else if (event.pointerType === 'mouse') {
        pointer.tx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2))
        pointer.ty = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2))
      }
    }

    const onDown = (event: PointerEvent) => {
      if (reduce) return
      // Start drag tracking
      pointer.isDragging = true
      lastPointerX = event.clientX
      lastPointerY = event.clientY
      try {
        root.setPointerCapture(event.pointerId)
      } catch {
        // pointer capture fallback
      }
    }

    const onUp = (event: PointerEvent) => {
      pointer.isDragging = false
      try {
        if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId)
      } catch {
        // fallback
      }
    }

    const onLeave = () => {
      if (!pointer.isDragging) {
        pointer.tx = 0
        pointer.ty = 0
      }
    }

    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerup', onUp)
    root.addEventListener('pointercancel', onUp)
    root.addEventListener('pointerleave', onLeave)

    still()
    play()
    return () => {
      stop()
      resize.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerup', onUp)
      root.removeEventListener('pointercancel', onUp)
      root.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, nodes, angles])

  const ticks = useMemo(() => Array.from({ length: TICKS }, (_, i) => {
    const a = (i / TICKS) * Math.PI * 2
    const long = i % 6 === 0
    const r1 = 308
    const r2 = long ? 298 : 303
    return { x1: Math.cos(a) * r1, y1: Math.sin(a) * r1, x2: Math.cos(a) * r2, y2: Math.sin(a) * r2, long }
  }), [])

  const style = { '--h1': hues.a, '--h2': hues.b } as React.CSSProperties

  return (
    <figure className={`wlt-orb ${nodes.length === 0 ? 'is-bare' : ''}`} style={style} aria-label={summary}>
      <div className="wlt-orb__stage" ref={rootRef} aria-hidden="true">
        <span className="wlt-orb__floor" />
        <svg className="wlt-orb__ticks" viewBox={`${-ORB_SIZE / 2} ${-ORB_SIZE / 2} ${ORB_SIZE} ${ORB_SIZE}`} focusable="false">
          {ticks.map((tick, i) => <line key={i} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} className={tick.long ? 'is-long' : ''} />)}
        </svg>
        <svg className="wlt-orb__rings wlt-orb__rings--back" viewBox={`${-ORB_SIZE / 2} ${-ORB_SIZE / 2} ${ORB_SIZE} ${ORB_SIZE}`} focusable="false">
          {RING_ORDER.map((id) => <path key={id} ref={(node) => { backRefs.current[id] = node }} className={`wlt-orb__ring is-${id}`} />)}
        </svg>
        <div className="wlt-orb__core">
          <span className="wlt-orb__sphere" />
          <span className="wlt-orb__core-text"><b>{glyph}</b><i>{caption}</i>{captionSub ? <small>{captionSub}</small> : null}</span>
        </div>
        <svg className="wlt-orb__rings wlt-orb__rings--front" viewBox={`${-ORB_SIZE / 2} ${-ORB_SIZE / 2} ${ORB_SIZE} ${ORB_SIZE}`} focusable="false">
          {RING_ORDER.map((id) => <path key={id} ref={(node) => { frontRefs.current[id] = node }} className={`wlt-orb__ring is-${id}`} />)}
        </svg>
        {nodes.map((node) => (
          <span
            key={node.id}
            ref={(el) => { if (el) nodeRefs.current.set(node.id, el); else nodeRefs.current.delete(node.id) }}
            className={`wlt-orb__node is-${node.kind} ${node.active ? 'is-active' : ''} is-interactive`}
            title={`${node.label}${node.sub ? ` (${node.sub})` : ''} · Jump to ${node.kind === 'token' ? 'tokens' : node.kind === 'nft' ? 'NFTs' : 'networks'}`}
            onPointerEnter={() => setHovered(node)}
            onPointerLeave={() => setHovered((current) => (current?.id === node.id ? null : current))}
            onClick={(e) => {
              e.stopPropagation()
              onSelectNode?.(node)
            }}
          >
            <NodeFace node={node} />
            {node.kind === 'network' && <em>{node.label}</em>}
          </span>
        ))}
      </div>
      <figcaption className="wlt-orb__legend">
        <span className={hovered ? 'is-hover' : ''}>
          {hovered
            ? <><b>{hovered.label}</b>{hovered.sub ? <i>{hovered.sub}</i> : null}</>
            : (
              <>
                <button type="button" className="wlt-orb__key is-tokens" onClick={() => onSelectRing?.('tokens')} title="Jump to tokens section">Tokens</button>
                <button type="button" className="wlt-orb__key is-nfts" onClick={() => onSelectRing?.('nfts')} title="Jump to NFTs section">NFTs</button>
                <button type="button" className="wlt-orb__key is-networks" onClick={() => onSelectRing?.('networks')} title="Jump to network section">Networks</button>
              </>
            )}
        </span>
      </figcaption>
    </figure>
  )
}
