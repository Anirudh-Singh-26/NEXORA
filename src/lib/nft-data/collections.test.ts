import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { CollectionsError, fetchLiveCollections, fromDemoCollection, parseCollectionsResponse, resetCollectionsClientCache, shortOwner } from './collections.ts'
import { filterListed } from './listing.ts'
import { fmtCount, fmtFloor, fmtVolume } from './format.ts'
import type { Collection } from '../../data/types.ts'

const dto = (slug: string, over: Record<string, unknown> = {}) => ({
  rank: 1, slug, name: slug, description: null, imageUrl: 'https://i.example/a.png', bannerUrl: null, category: 'art', chain: 'ethereum',
  owner: '0x1234567890abcdef1234567890abcdef12345678', openseaUrl: `https://opensea.io/collection/${slug}`,
  floor: { value: 1.2, symbol: 'ETH' }, volume24h: { value: 30, symbol: 'ETH' }, items: 1000, owners: 400, ...over,
})
const payload = (rows: unknown[], extra: Record<string, unknown> = {}) => ({ source: 'opensea', fetchedAt: 1_700_000_000_000, partial: false, collections: rows, ...extra })
beforeEach(() => resetCollectionsClientCache())

test('parse: maps fields, nulls stay null, unsafe/invalid rows dropped', () => {
  const s = parseCollectionsResponse(payload([
    dto('a'),
    dto('b', { floor: null, volume24h: { value: 0, symbol: 'ETH' }, items: null, owners: 0, category: 'music', owner: null, imageUrl: 'javascript:alert(1)' }),
    dto('c', { chain: 'monad' }), dto('a'), dto('d', { openseaUrl: 'http://x' }), 'junk',
  ]))
  assert.deepEqual(s.collections.map((c) => c.slug), ['a', 'b'])
  const [a, b] = s.collections
  assert.equal(a.creator, '0x1234…5678')
  assert.equal(a.category, 'art')
  assert.equal(b.floor, null); assert.equal(b.items, null); assert.equal(b.owners, null) // 0 owners -> unknown
  assert.deepEqual(b.volume24h, { value: 0, symbol: 'ETH' }) // a genuine zero with a unit is kept
  assert.equal(b.category, null); assert.equal(b.creator, null); assert.equal(b.cover, null)
  assert.equal(a.source, 'live')
})

test('parse: rejects unusable payloads', () => {
  assert.throws(() => parseCollectionsResponse(null), CollectionsError)
  assert.throws(() => parseCollectionsResponse({ ...payload([]), source: 'x' }), CollectionsError)
  assert.throws(() => parseCollectionsResponse(payload([])), CollectionsError)
})

test('formatters show an em dash for missing values, never zero', () => {
  assert.equal(fmtFloor(null), '—'); assert.equal(fmtVolume(null), '—'); assert.equal(fmtCount(null), '—')
  assert.equal(fmtVolume({ value: 1500, symbol: 'ETH' }), '1.5K ETH')
  assert.equal(fmtVolume({ value: 1500, symbol: '' }), '1.5K')
  assert.equal(shortOwner('someone'), 'someone')
})

test('listing: filter, provider-rank volume sort, nulls last, floor grouped by currency', () => {
  const rows = parseCollectionsResponse(payload([
    dto('alpha', { rank: 1, floor: { value: 5, symbol: 'ETH' }, items: 10 }),
    dto('beta', { rank: 2, chain: 'solana', floor: { value: 2, symbol: 'SOL' }, items: null }),
    dto('gamma', { rank: 3, floor: null, items: 500, category: 'gaming' }),
    dto('delta', { rank: 4, floor: { value: 1, symbol: 'ETH' }, items: 20 }),
  ])).collections
  const f = (o: Partial<Parameters<typeof filterListed>[1]>) => filterListed(rows, { query: '', network: 'all', category: 'all', sort: 'volume', ...o }).map((c) => c.slug)
  assert.deepEqual(f({}), ['alpha', 'beta', 'gamma', 'delta'])
  assert.deepEqual(f({ sort: 'floor' }), ['delta', 'alpha', 'beta', 'gamma'])
  assert.deepEqual(f({ sort: 'items' }), ['gamma', 'delta', 'alpha', 'beta'])
  assert.deepEqual(f({ sort: 'name' }), ['alpha', 'beta', 'delta', 'gamma'])
  assert.deepEqual(f({ network: 'solana' }), ['beta'])
  assert.deepEqual(f({ category: 'gaming' }), ['gamma'])
  assert.deepEqual(f({ query: 'ELT' }), ['delta'])
})

test('demo adapter keeps demo values and labels them demo', () => {
  const c = { id: 'x', slug: 'x', name: 'X', networkId: 'base', category: 'art', floor: 2, floorSymbol: 'ETH', volume24h: 9, items: 5, owners: 3, cover: 'c', banner: 'b', description: 'd', creator: 'me', nfts: [{ image: 'i1' }] } as unknown as Collection
  const l = fromDemoCollection(c)
  assert.equal(l.source, 'demo'); assert.deepEqual(l.preview, ['i1']); assert.equal(l.floor?.value, 2)
})

const resp = (body: unknown, status = 200, type = 'application/json') => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } })

test('fetch: classifies proxy missing (HTML 200), not-configured, rate limit, http', async () => {
  const k = (r: () => Response) => fetchLiveCollections({ fetchImpl: (async () => r()) as typeof fetch, forceRefresh: true })
  await assert.rejects(k(() => resp('<html></html>', 200, 'text/html')), { kind: 'proxy-missing' })
  await assert.rejects(k(() => resp('nope', 404, 'text/html')), { kind: 'proxy-missing' })
  await assert.rejects(k(() => resp({ error: 'not-configured' }, 503)), { kind: 'not-configured' })
  await assert.rejects(k(() => resp({ error: 'upstream-auth' }, 502)), { kind: 'upstream-auth' })
  await assert.rejects(k(() => resp({ error: 'rate-limited' }, 429)), { kind: 'rate-limited' })
  await assert.rejects(k(() => resp({ error: 'upstream' }, 502)), { kind: 'http' })
  await assert.rejects(k(() => resp({ nope: 1 })), { kind: 'malformed' })
})

test('fetch: caches success; one aborted caller does not cancel the shared request', async () => {
  let calls = 0
  let sig: AbortSignal | undefined
  const slow = ((_u: string, init?: RequestInit) => {
    calls++; sig = init?.signal ?? undefined
    return new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      setTimeout(() => resolve(resp(payload([dto('a')]))), 20)
    })
  }) as unknown as typeof fetch
  const first = new AbortController()
  const a = fetchLiveCollections({ fetchImpl: slow, forceRefresh: true, signal: first.signal })
  first.abort()
  const b = fetchLiveCollections({ fetchImpl: slow, signal: new AbortController().signal })
  await assert.rejects(a, { kind: 'aborted' })
  assert.equal((await b).collections.length, 1)
  assert.equal(sig?.aborted, false)
  await fetchLiveCollections({ fetchImpl: slow })
  assert.equal(calls, 1)
})
