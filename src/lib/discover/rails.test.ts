import assert from 'node:assert/strict'
import test from 'node:test'
import type { Token } from '../../data/types.ts'
import type { ListedCollection } from '../nft-data/types.ts'
import { liveCollectionHref, pickRailCollections, pickRailTokens } from './rails.ts'

const token = (id: string, volume24h: number) => ({ id, volume24h }) as unknown as Token
const col = (slug: string, rank: number | undefined, source: 'live' | 'demo' = 'live') => ({ slug, rank, source }) as unknown as ListedCollection

test('tokens are ordered by 24h volume, limited, and the input is not mutated', () => {
  const input = [token('a', 1), token('b', 30), token('c', 20)]
  assert.deepEqual(pickRailTokens(input, 2).map((t) => t.id), ['b', 'c'])
  assert.deepEqual(input.map((t) => t.id), ['a', 'b', 'c'])
  assert.deepEqual(pickRailTokens([], 8), [])
})

test('collections keep provider rank order, drop demo rows and respect the limit', () => {
  const input = [col('c', 3), col('x', 1, 'demo'), col('a', 1), col('b', 2), col('z', undefined)]
  assert.deepEqual(pickRailCollections(input, 3).map((c) => c.slug), ['a', 'b', 'c'])
  assert.deepEqual(pickRailCollections(input).map((c) => c.slug), ['a', 'b', 'c', 'z'])
})

test('live collection route encodes the slug and selects the live detail', () => {
  assert.equal(liveCollectionHref({ slug: 'boredapeyachtclub' }), '/collections/boredapeyachtclub?source=opensea')
  assert.equal(liveCollectionHref({ slug: 'a b/c' }), '/collections/a%20b%2Fc?source=opensea')
})
