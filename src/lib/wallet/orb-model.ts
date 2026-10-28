/**
 * Pure model for the Wallets page "orb": a small, decorative-but-truthful 3D arrangement of what a wallet holds.
 * No React, no DOM. Every node is derived from data that is already loaded (tokens, NFTs, networks); when nothing is
 * loaded there are simply no holding nodes. Nothing here invents holdings, balances or prices.
 */

export type RingId = 'tokens' | 'nfts' | 'networks'
export type OrbNodeKind = 'token' | 'nft' | 'network'

export interface Vec3 { x: number; y: number; z: number }

export interface RingSpec {
  id: RingId
  /** Radius in orb units (the orb is laid out on a 640 × 640 square). */
  radius: number
  /** Tilt of the ring plane about the X axis, radians. */
  tiltX: number
  /** Tilt about the Z axis, radians. */
  tiltZ: number
  /** Angular speed, radians per second (sign sets direction). */
  speed: number
}

export const ORB_SIZE = 640
export const FOCAL = 1600

export const RINGS: Readonly<Record<RingId, RingSpec>> = {
  tokens: { id: 'tokens', radius: 158, tiltX: 0.18, tiltZ: -0.22, speed: 0.1 },
  nfts: { id: 'nfts', radius: 214, tiltX: -0.34, tiltZ: 0.3, speed: -0.07 },
  networks: { id: 'networks', radius: 276, tiltX: 0.52, tiltZ: -0.12, speed: 0.045 },
}

export const RING_ORDER: readonly RingId[] = ['tokens', 'nfts', 'networks']

export interface OrbNode {
  id: string
  ring: RingId
  kind: OrbNodeKind
  /** Short text shown in the caption and used as the glyph fallback. */
  label: string
  /** Second caption line (amount, collection, "active network"…). */
  sub: string | null
  /** https image (token logo / NFT preview) or null. */
  image: string | null
  /** Seed for the fallback colour. */
  seed: string
  active: boolean
}

/** Same hash as the avatar gradient so the orb and the avatar always agree. */
export function addressHash(address: string): number {
  let hash = 2166136261
  for (let i = 0; i < address.length; i += 1) hash = Math.imul(hash ^ address.charCodeAt(i), 16777619)
  return hash
}

export function identityHues(address: string): { a: number; b: number } {
  const hash = addressHash(address)
  const a = Math.abs(hash) % 360
  const b = (a + 70 + (Math.abs(hash >> 9) % 80)) % 360
  return { a, b }
}

/** Brand hues for the dormant (disconnected) orb. */
export const BRAND_HUES = { a: 262, b: 188 } as const

export function ringPoint(ring: RingSpec, angle: number): Vec3 {
  // Circle in the XZ plane, then tilt about X, then about Z.
  const x0 = ring.radius * Math.cos(angle)
  const z0 = ring.radius * Math.sin(angle)
  const cx = Math.cos(ring.tiltX)
  const sx = Math.sin(ring.tiltX)
  const y1 = -z0 * sx
  const z1 = z0 * cx
  const cz = Math.cos(ring.tiltZ)
  const sz = Math.sin(ring.tiltZ)
  return { x: x0 * cz - y1 * sz, y: x0 * sz + y1 * cz, z: z1 }
}

/** Camera: yaw about Y, then pitch about X. Positive z points toward the viewer. */
export function rotateView(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const x1 = p.x * cy + p.z * sy
  const z1 = -p.x * sy + p.z * cy
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  return { x: x1, y: p.y * cp - z1 * sp, z: p.y * sp + z1 * cp }
}

export interface Projected { x: number; y: number; scale: number; z: number }

export function project(p: Vec3, focal: number = FOCAL): Projected {
  const scale = focal / (focal - p.z)
  return { x: p.x * scale, y: p.y * scale, scale, z: p.z }
}

/** `count` angles evenly spread around a ring, starting at `offset`. */
export function spreadAngles(count: number, offset = 0): number[] {
  if (count <= 0) return []
  return Array.from({ length: count }, (_, index) => offset + (index / count) * Math.PI * 2)
}

/** Closed outline of a ring as projected points (used for the SVG path). */
export function ringOutline(ring: RingSpec, yaw: number, pitch: number, steps = 96, phase = 0): Projected[] {
  const out: Projected[] = []
  for (let i = 0; i <= steps; i += 1) {
    out.push(project(rotateView(ringPoint(ring, phase + (i / steps) * Math.PI * 2), yaw, pitch)))
  }
  return out
}

/**
 * Splits an outline into runs on the near (z >= 0) and far side so the far side can be drawn dimmer, and returns
 * SVG path data for each side.
 */
export function splitOutline(points: readonly Projected[]): { front: string; back: string } {
  let front = ''
  let back = ''
  let previous: 'front' | 'back' | null = null
  for (const point of points) {
    const side = point.z >= 0 ? 'front' : 'back'
    const cmd = `${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    if (side !== previous) {
      // Start a new sub-path; repeat the previous point so the sides meet without a gap.
      if (side === 'front') front += `M${cmd}`
      else back += `M${cmd}`
    } else if (side === 'front') front += `L${cmd}`
    else back += `L${cmd}`
    previous = side
  }
  return { front, back }
}

// ---- node building ---------------------------------------------------------------------------------------------

export interface OrbTokenInput { contract: string; symbol: string | null; name: string | null; logo: string | null; amount: string | null }
export interface OrbNftInput { contract: string; tokenId: string; name: string | null; collectionName: string | null; image: string | null }
export interface OrbNetworkInput { id: string; label: string; active: boolean; detail: string | null }

export const MAX_TOKEN_NODES = 8
export const MAX_NFT_NODES = 8

function glyphOf(text: string | null | undefined, fallback: string): string {
  const trimmed = (text ?? '').trim()
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : fallback
}
export { glyphOf }

/**
 * One node per loaded holding (capped so the orb stays legible) and one per known network. Holdings keep the order the
 * provider returned them in; nothing is ranked by value because no verified price source exists.
 */
export function buildOrbNodes(input: { tokens: readonly OrbTokenInput[]; nfts: readonly OrbNftInput[]; networks: readonly OrbNetworkInput[] }): OrbNode[] {
  const nodes: OrbNode[] = []
  for (const token of input.tokens.slice(0, MAX_TOKEN_NODES)) {
    nodes.push({
      id: `token:${token.contract}`, ring: 'tokens', kind: 'token',
      label: token.symbol ?? token.name ?? 'Token', sub: token.amount ? `${token.amount}${token.symbol ? ` ${token.symbol}` : ''}` : token.name,
      image: token.logo, seed: token.contract, active: false,
    })
  }
  // Prefer one NFT per collection first so the ring shows variety, then fill with the rest.
  const seenCollections = new Set<string>()
  const firstPass: OrbNftInput[] = []
  const rest: OrbNftInput[] = []
  for (const nft of input.nfts) {
    const key = nft.collectionName ?? `${nft.contract}`
    if (seenCollections.has(key)) rest.push(nft)
    else { seenCollections.add(key); firstPass.push(nft) }
  }
  for (const nft of [...firstPass, ...rest].slice(0, MAX_NFT_NODES)) {
    nodes.push({
      id: `nft:${nft.contract}:${nft.tokenId}`, ring: 'nfts', kind: 'nft',
      label: nft.name ?? `#${nft.tokenId.slice(0, 6)}`, sub: nft.collectionName,
      image: nft.image, seed: `${nft.contract}:${nft.tokenId}`, active: false,
    })
  }
  for (const network of input.networks) {
    nodes.push({
      id: `network:${network.id}`, ring: 'networks', kind: 'network',
      label: network.label, sub: network.detail ?? (network.active ? 'Active network' : null),
      image: null, seed: network.id, active: network.active,
    })
  }
  return nodes
}

/** Angle assigned to each node: evenly spread per ring with a stable per-ring offset. */
export function assignAngles(nodes: readonly OrbNode[]): Map<string, number> {
  const out = new Map<string, number>()
  const offsets: Record<RingId, number> = { tokens: 0.4, nfts: 1.9, networks: 3.3 }
  for (const ring of RING_ORDER) {
    const members = nodes.filter((node) => node.ring === ring)
    const angles = spreadAngles(members.length, offsets[ring])
    members.forEach((node, index) => out.set(node.id, angles[index]))
  }
  return out
}
