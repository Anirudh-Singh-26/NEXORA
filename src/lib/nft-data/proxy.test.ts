import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { buildCollections, handleCollections, parseStats, resetCollectionsCache } from '../../../api/collections.ts'

const KEY = 'test-secret-key'
const top = (rows: unknown[]) => ({ collections: rows, next: null })
const row = (slug: string, chain = 'ethereum', over: Record<string, unknown> = {}) => ({
  collection: slug, name: slug.toUpperCase(), opensea_url: `https://opensea.io/collection/${slug}`, safelist_status: 'verified',
  contracts: [{ address: '0xabc', chain }], is_disabled: false, is_nsfw: false, image_url: 'https://img.example/a.png',
  banner_image_url: null, category: 'art', description: 'd', owner: '0xowner', ...over,
})
const stats = (floor: number, sym: string, vol: number, owners = 10) => ({
  total: { floor_price: floor, floor_price_symbol: sym, num_owners: owners, sales: 5, volume: 99, volume_symbol: sym },
  intervals: [{ interval: 'one_day', sales: 1, volume: vol, volume_symbol: sym }],
})

function router(opts: { rows: unknown[]; statsFor?: Record<string, unknown>; status429For?: string[]; topStatus?: number }) {
  const calls: { url: string; key: string | null }[] = []
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, key: new Headers(init?.headers).get('x-api-key') })
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (url.includes('/collections/top')) return json(opts.topStatus && opts.topStatus !== 200 ? { errors: ['x'] } : top(opts.rows), opts.topStatus ?? 200)
    const m = /collections\/([^/]+)(\/stats)?$/.exec(url)
    const slug = m?.[1] ?? ''
    if (opts.status429For?.includes(slug)) return json({ errors: ['slow'] }, 429)
    if (m?.[2]) return json(opts.statsFor?.[slug] ?? stats(1.5, 'ETH', 20))
    return json({ collection: slug, total_supply: 10_000 })
  }) as typeof fetch
  return { impl, calls }
}

beforeEach(() => resetCollectionsCache())

test('parseStats: no listing and unknown units become null, not zero', () => {
  const s = parseStats({ total: { floor_price: 0, floor_price_symbol: '', num_owners: 0 }, intervals: [{ interval: 'one_day', volume: 5, volume_symbol: '' }] })
  assert.deepEqual(s, { floor: null, volume24h: null, owners: null })
  assert.equal(parseStats({}), null)
})

test('buildCollections maps, filters NSFW/disabled/unsupported chains, keeps provider rank', async () => {
  const { impl } = router({ rows: [row('a'), row('nsfw', 'ethereum', { is_nsfw: true }), row('off', 'ethereum', { is_disabled: true }), row('b', 'solana'), row('odd', 'monad'), row('c', 'base', { image_url: 'http://insecure/x.png' })] })
  const res = await buildCollections({ apiKey: KEY, fetchImpl: impl })
  assert.deepEqual(res.collections.map((c) => c.slug), ['a', 'b', 'c'])
  assert.deepEqual(res.collections.map((c) => c.rank), [1, 2, 3])
  assert.equal(res.collections[0].floor?.symbol, 'ETH')
  assert.equal(res.collections[0].items, 10_000)
  assert.equal(res.collections[2].imageUrl, null) // non-https artwork rejected
  assert.equal(res.partial, false)
})

test('429 on per-collection stats yields partial data with nulls', async () => {
  const { impl } = router({ rows: [row('a'), row('b')], status429For: ['a'] })
  const res = await buildCollections({ apiKey: KEY, fetchImpl: impl })
  assert.equal(res.partial, true)
  assert.equal(res.collections[0].floor, null)
  assert.equal(res.collections[0].volume24h, null)
})

test('handler: key goes only upstream, never into the response; caches; GET only', async () => {
  const { impl, calls } = router({ rows: [row('a')] })
  const req = () => new Request('http://localhost/api/collections')
  const r1 = await handleCollections(req(), { apiKey: KEY, fetchImpl: impl })
  assert.equal(r1.status, 200)
  assert.ok(!(await r1.clone().text()).includes(KEY))
  assert.ok(calls.length === 3 && calls.every((c) => c.key === KEY))
  await handleCollections(req(), { apiKey: KEY, fetchImpl: impl })
  assert.equal(calls.length, 3) // second request served from cache
  assert.equal((await handleCollections(new Request('http://localhost/api/collections', { method: 'POST' }), { apiKey: KEY, fetchImpl: impl })).status, 405)
})

test('handler error mapping: missing key, bad key, rate limit, upstream failure', async () => {
  const r = (opts: Parameters<typeof router>[0], key = KEY) => {
    resetCollectionsCache()
    return handleCollections(new Request('http://localhost/api/collections'), { apiKey: key, fetchImpl: router(opts).impl })
  }
  const missing = await r({ rows: [] }, '')
  assert.equal(missing.status, 503); assert.deepEqual(await missing.json(), { error: 'not-configured' })
  assert.deepEqual(await (await r({ rows: [], topStatus: 401 })).json(), { error: 'upstream-auth' })
  assert.equal((await r({ rows: [], topStatus: 429 })).status, 429)
  assert.equal((await r({ rows: [], topStatus: 500 })).status, 502)
})
