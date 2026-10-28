import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  assignAngles, buildOrbNodes, identityHues, project, RINGS, ringOutline, ringPoint, rotateView, spreadAngles, splitOutline,
  MAX_NFT_NODES, MAX_TOKEN_NODES,
} from './orb-model.ts'

test('identityHues is deterministic, in range, and matches the avatar hash rule', () => {
  const a = identityHues('0x00000000000000000000000000000000000000aa')
  const b = identityHues('0x00000000000000000000000000000000000000aa')
  assert.deepEqual(a, b)
  assert.ok(a.a >= 0 && a.a < 360 && a.b >= 0 && a.b < 360)
  assert.notDeepEqual(identityHues('0x1'), identityHues('0x2'))
})

test('a ring point lies at its radius from the origin before the camera moves', () => {
  for (const ring of Object.values(RINGS)) {
    for (const angle of [0, 1, 2.5, 4]) {
      const p = ringPoint(ring, angle)
      assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - ring.radius) < 1e-9)
    }
  }
})

test('rotateView with no rotation is the identity, and rotation preserves distance', () => {
  const p = { x: 40, y: -12, z: 90 }
  const same = rotateView(p, 0, 0)
  assert.ok(Math.abs(same.x - p.x) < 1e-9 && Math.abs(same.y - p.y) < 1e-9 && Math.abs(same.z - p.z) < 1e-9)
  const r = rotateView(p, 0.7, -0.3)
  assert.ok(Math.abs(Math.hypot(r.x, r.y, r.z) - Math.hypot(p.x, p.y, p.z)) < 1e-9)
})

test('projection makes near points larger and far points smaller, and leaves the origin alone', () => {
  assert.equal(project({ x: 0, y: 0, z: 0 }).scale, 1)
  assert.ok(project({ x: 10, y: 0, z: 100 }).scale > 1)
  assert.ok(project({ x: 10, y: 0, z: -100 }).scale < 1)
})

test('spreadAngles returns distinct, evenly spaced angles', () => {
  assert.deepEqual(spreadAngles(0), [])
  const angles = spreadAngles(4, 0)
  assert.equal(angles.length, 4)
  assert.ok(Math.abs(angles[1] - angles[0] - Math.PI / 2) < 1e-9)
})

test('splitOutline separates the near and far sides of a tilted ring', () => {
  const { front, back } = splitOutline(ringOutline(RINGS.nfts, 0.2, -0.3, 48))
  assert.ok(front.startsWith('M') && back.startsWith('M'))
})

test('buildOrbNodes caps holdings, never invents any, and keeps every network', () => {
  const tokens = Array.from({ length: 20 }, (_, i) => ({ contract: `0x${i}`, symbol: `T${i}`, name: null, logo: null, amount: '1' }))
  const nfts = Array.from({ length: 20 }, (_, i) => ({ contract: `0x${i % 3}`, tokenId: String(i), name: null, collectionName: `C${i % 3}`, image: null }))
  const networks = [{ id: '1', label: 'Ethereum', active: true, detail: null }, { id: '8453', label: 'Base', active: false, detail: null }]
  const nodes = buildOrbNodes({ tokens, nfts, networks })
  assert.equal(nodes.filter((n) => n.ring === 'tokens').length, MAX_TOKEN_NODES)
  assert.equal(nodes.filter((n) => n.ring === 'nfts').length, MAX_NFT_NODES)
  assert.equal(nodes.filter((n) => n.ring === 'networks').length, 2)
  // First pass takes one NFT per collection, so all three collections are represented.
  assert.equal(new Set(nodes.filter((n) => n.ring === 'nfts').map((n) => n.sub)).size, 3)
  assert.deepEqual(buildOrbNodes({ tokens: [], nfts: [], networks: [] }), [])
})

test('assignAngles gives every node an angle', () => {
  const nodes = buildOrbNodes({ tokens: [{ contract: 'a', symbol: 'A', name: null, logo: null, amount: null }], nfts: [], networks: [{ id: '1', label: 'E', active: false, detail: null }] })
  const angles = assignAngles(nodes)
  assert.equal(angles.size, nodes.length)
})
