import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { handleCollection, parseDetailStats, parseItems, parseTraits, resetCollectionCache } from '../../../api/collection.ts'
import { CollectionDetailError, collectionDetailErrorMessage, fetchLiveCollection, parseCollectionDetailResponse, resetCollectionDetailClientCache } from './collection-detail.ts'

const KEY = 'test-secret-key'
const base = (slug: string, over: Record<string, unknown> = {}) => ({
  collection: slug, name: slug.toUpperCase(), opensea_url: `https://opensea.io/collection/${slug}`, description: 'desc',
  image_url: 'https://img.example/a.png', banner_image_url: 'https://img.example/b.png', category: 'art', owner: '0x1234567890abcdef1234567890abcdef12345678',
  contracts: [{ address: '0xabc', chain: 'ethereum' }], total_supply: 10_000, is_disabled: false, is_nsfw: false,
  created_date: '2022-01-02T00:00:00', safelist_status: 'verified', project_url: 'https://azuki.com', wiki_url: 'http://insecure.example', discord_url: 'https://discord.gg/azuki',
  twitter_username: 'azuki', instagram_username: 'bad name!', fees: [{ fee: 2.5, recipient: '0xfee', required: true }, { fee: 'x' }], ...over,
})
const stats = {
  total: { floor_price: 1.5, floor_price_symbol: 'ETH', num_owners: 400, volume: 900, volume_symbol: 'ETH', sales: 120, average_price: 7.5, market_cap: 15000 },
  intervals: [
    { interval: 'one_day', volume: 20, volume_symbol: 'ETH', volume_diff: -5, volume_change: -0.2, sales: 4, sales_diff: 1, average_price: 5 },
    { interval: 'seven_day', volume: 100, volume_symbol: 'ETH', volume_diff: 30, sales: 25, sales_diff: -3, average_price: 4 },
    { interval: 'thirty_day', volume: 400, volume_symbol: 'ETH', sales: 90 },
  ],
}
const traitsBody = { categories: { Background: 'string', Eyes: 'string' }, counts: { Background: { Red: 30, Blue: 70, Green: 5 }, Eyes: { Open: 10 } } }
const nftsBody = { nfts: [
  { identifier: '1', collection: 'azuki', name: 'Azuki #1', image_url: 'https://i.example/1.png', is_disabled: false, is_nsfw: false },
  { identifier: '2', name: null, image_url: 'http://insecure/2.png' },
  { identifier: '3', name: 'nsfw', is_nsfw: true },
  { name: 'no id' },
], next: 'cursor' }

function upstream(over: { base?: unknown; baseStatus?: number; stats?: unknown; statsStatus?: number; traits?: unknown; traitsStatus?: number; nfts?: unknown; nftsStatus?: number } = {}) {
  const calls: { url: string; key: string | null }[] = []
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, key: new Headers(init?.headers).get('x-api-key') })
    if (url.includes('/traits/')) return new Response(JSON.stringify(over.traits ?? traitsBody), { status: over.traitsStatus ?? 200 })
    if (url.includes('/nfts')) return new Response(JSON.stringify(over.nfts ?? nftsBody), { status: over.nftsStatus ?? 200 })
    const isStats = url.endsWith('/stats')
    const status = isStats ? over.statsStatus ?? 200 : over.baseStatus ?? 200
    const body = isStats ? over.stats ?? stats : over.base ?? base('azuki')
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  return { impl, calls }
}
const get = (slug: string) => new Request(`http://localhost/api/collection?slug=${encodeURIComponent(slug)}`)

beforeEach(() => { resetCollectionCache(); resetCollectionDetailClientCache() })

test('parseDetailStats: maps totals and intervals; unknown units and zero floor become null', () => {
  const p = parseDetailStats(stats)
  assert.deepEqual(p?.floor, { value: 1.5, symbol: 'ETH' })
  assert.deepEqual(p?.volume24h, { value: 20, symbol: 'ETH' })
  assert.equal(p?.owners, 400)
  assert.equal(p?.sales24h, 4)
  assert.deepEqual(p?.stats.totalVolume, { value: 900, symbol: 'ETH' })
  assert.equal(p?.stats.totalSales, 120)
  assert.deepEqual(p?.stats.averagePrice, { value: 7.5, symbol: 'ETH' }) // unit inferred from volume_symbol
  assert.deepEqual(p?.stats.marketCap, { value: 15000, symbol: 'ETH' }) // unit inferred from the floor symbol
  assert.deepEqual(p?.stats.intervals.oneDay?.volumeDiff, { value: -5, symbol: 'ETH' }) // negative diffs are kept
  assert.equal(p?.stats.intervals.sevenDay?.salesDiff, -3)
  assert.equal(p?.stats.intervals.thirtyDay?.volumeDiff, null)
  const none = parseDetailStats({ total: { floor_price: 0, floor_price_symbol: '', num_owners: 0, volume: 5 }, intervals: [{ interval: 'one_day', volume: 5, volume_symbol: '' }] })
  assert.equal(none?.floor, null); assert.equal(none?.volume24h, null); assert.equal(none?.owners, null)
  assert.equal(none?.stats.totalVolume, null) // no unit → unknown, not a bare number
  assert.equal(none?.stats.intervals.oneDay, null)
  assert.equal(parseDetailStats(null), null)
})

test('parseTraits / parseItems: capped, sorted, and only what the API supplies', () => {
  const t = parseTraits(traitsBody)
  assert.equal(t?.totalCategories, 2)
  assert.deepEqual(t?.categories[0].values.map((v) => v.value), ['Blue', 'Red', 'Green']) // most common first
  assert.equal(t?.categories[0].distinctValues, 3)
  const big = parseTraits({ counts: { Many: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`v${i}`, i + 1])) } })
  assert.equal(big?.categories[0].values.length, 6); assert.equal(big?.categories[0].distinctValues, 20)
  assert.equal(parseTraits({}), null); assert.equal(parseTraits({ counts: { X: {} } }), null)
  const items = parseItems(nftsBody)
  assert.deepEqual(items.map((i) => i.identifier), ['1', '2']) // NSFW and id-less rows dropped
  assert.equal(items[0].imageUrl, 'https://i.example/1.png'); assert.equal(items[1].imageUrl, null); assert.equal(items[1].name, null)
  assert.equal(parseItems(null).length, 0)
})

test('proxy: returns mapped detail; key only goes upstream, never into the response', async () => {
  const { impl, calls } = upstream()
  const res = await handleCollection(get('azuki'), { apiKey: KEY, fetchImpl: impl })
  const raw = await res.text()
  assert.equal(res.status, 200)
  assert.ok(!raw.includes(KEY))
  const body = JSON.parse(raw)
  assert.equal(body.source, 'opensea')
  assert.equal(body.partial, false)
  assert.equal(body.collection.slug, 'azuki')
  assert.equal(body.collection.chain, 'ethereum')
  assert.deepEqual(body.collection.floor, { value: 1.5, symbol: 'ETH' })
  assert.equal(body.collection.items, 10_000)
  assert.equal(body.collection.owners, 400)
  assert.ok(calls.every((c) => c.key === KEY))
  assert.deepEqual(body.unavailable, [])
  assert.equal(body.collection.sales24h, 4)
  assert.equal(body.collection.createdDate, '2022-01-02T00:00:00')
  assert.equal(body.collection.safelistStatus, 'verified')
  assert.deepEqual(body.collection.contracts, [{ address: '0xabc', chain: 'ethereum' }])
  assert.deepEqual(body.collection.fees, [{ fee: 2.5, required: true, recipient: '0xfee' }]) // malformed fee dropped
  assert.equal(body.collection.links.projectUrl, 'https://azuki.com')
  assert.equal(body.collection.links.wikiUrl, null) // non-https rejected
  assert.equal(body.collection.links.twitterUsername, 'azuki')
  assert.equal(body.collection.links.instagramUsername, null) // invalid handle rejected
  assert.equal(body.collection.traits.totalCategories, 2)
  assert.equal(body.collection.sampleItems.length, 2)
  assert.deepEqual(calls.map((c) => c.url).sort(), [
    'https://api.opensea.io/api/v2/collection/azuki/nfts?limit=8',
    'https://api.opensea.io/api/v2/collections/azuki',
    'https://api.opensea.io/api/v2/collections/azuki/stats',
    'https://api.opensea.io/api/v2/traits/azuki',
  ])
})

test('proxy: caches per slug, GET only, validates slug, requires key', async () => {
  const { impl, calls } = upstream()
  await handleCollection(get('azuki'), { apiKey: KEY, fetchImpl: impl })
  await handleCollection(get('AZUKI'), { apiKey: KEY, fetchImpl: impl })
  assert.equal(calls.length, 4) // one request set; the second call was served from cache
  assert.equal((await handleCollection(new Request('http://localhost/api/collection?slug=azuki', { method: 'POST' }), { apiKey: KEY, fetchImpl: impl })).status, 405)
  for (const bad of ['', '../etc/passwd', 'a/b', 'a?b=1', '-lead']) assert.equal((await handleCollection(get(bad), { apiKey: KEY, fetchImpl: impl })).status, 400, bad)
  const missing = await handleCollection(get('azuki'), { apiKey: undefined, fetchImpl: impl })
  assert.equal(missing.status, 503)
  assert.deepEqual(await missing.json(), { error: 'not-configured' })
})

test('proxy: upstream statuses map to safe error codes', async () => {
  const cases: [number, number, string][] = [[404, 404, 'not-found'], [401, 502, 'upstream-auth'], [403, 502, 'upstream-auth'], [429, 429, 'rate-limited'], [500, 502, 'upstream-error']]
  for (const [up, status, code] of cases) {
    resetCollectionCache()
    const res = await handleCollection(get('x'), { apiKey: KEY, fetchImpl: upstream({ baseStatus: up, base: { errors: ['x'] } }).impl })
    assert.equal(res.status, status)
    assert.deepEqual(await res.json(), { error: code })
  }
  for (const flag of ['is_nsfw', 'is_disabled']) {
    resetCollectionCache()
    assert.equal((await handleCollection(get('x'), { apiKey: KEY, fetchImpl: upstream({ base: base('x', { [flag]: true }) }).impl })).status, 404)
  }
})

test('proxy: each optional section fails independently; the collection still renders', async () => {
  const res = await handleCollection(get('azuki'), { apiKey: KEY, fetchImpl: upstream({ statsStatus: 429, stats: { errors: [] }, traitsStatus: 500, nftsStatus: 503 }).impl })
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.partial, true)
  assert.deepEqual([...body.unavailable].sort(), ['items', 'stats', 'traits'])
  assert.equal(body.collection.floor, null); assert.equal(body.collection.volume24h, null); assert.equal(body.collection.owners, null)
  assert.equal(body.collection.sales24h, null); assert.equal(body.collection.stats, null)
  assert.equal(body.collection.traits, null); assert.deepEqual(body.collection.sampleItems, [])
  assert.equal(body.collection.items, 10_000) // from the main collection call
  resetCollectionCache()
  const onlyTraits = await (await handleCollection(get('azuki'), { apiKey: KEY, fetchImpl: upstream({ traitsStatus: 404 }).impl })).json()
  assert.deepEqual(onlyTraits.unavailable, ['traits']); assert.equal(onlyTraits.collection.floor.symbol, 'ETH')
})

test('proxy: a collection with no traits/items is not reported as a failure', async () => {
  const body = await (await handleCollection(get('azuki'), { apiKey: KEY, fetchImpl: upstream({ traits: { categories: {}, counts: {} }, nfts: { nfts: [] } }).impl })).json()
  assert.deepEqual(body.unavailable, []); assert.equal(body.partial, false)
  assert.equal(body.collection.traits, null); assert.deepEqual(body.collection.sampleItems, [])
})

test('proxy: unsupported chain → null, non-https artwork → null, polygon alias mapped', async () => {
  const odd = await (await handleCollection(get('odd'), { apiKey: KEY, fetchImpl: upstream({ base: base('odd', { contracts: [{ chain: 'monad' }], image_url: 'http://insecure/x.png' }) }).impl })).json()
  assert.equal(odd.collection.chain, null)
  assert.equal(odd.collection.imageUrl, null)
  resetCollectionCache()
  const poly = await (await handleCollection(get('p'), { apiKey: KEY, fetchImpl: upstream({ base: base('p', { contracts: [{ chain: 'matic' }] }) }).impl })).json()
  assert.equal(poly.collection.chain, 'polygon')
})

const dto = (over: Record<string, unknown> = {}) => ({
  slug: 'azuki', name: 'Azuki', description: null, imageUrl: 'https://i.example/a.png', bannerUrl: null, category: 'art', chain: 'ethereum',
  owner: '0x1234567890abcdef1234567890abcdef12345678', openseaUrl: 'https://opensea.io/collection/azuki',
  floor: { value: 1.2, symbol: 'ETH' }, volume24h: { value: 30, symbol: 'ETH' }, items: 1000, owners: 400, ...over,
})
const payload = (collection: unknown, extra: Record<string, unknown> = {}) => ({ source: 'opensea', fetchedAt: 1_700_000_000_000, partial: false, collection, ...extra })

test('client parse: maps fields, missing stay null, unsafe URLs dropped, unknown chain → null', () => {
  const s = parseCollectionDetailResponse(payload(dto({ floor: null, volume24h: { value: 0, symbol: 'ETH' }, items: null, owners: 0, imageUrl: 'javascript:alert(1)', chain: 'monad', owner: null })))
  const c = s.collection
  assert.equal(c.floor, null); assert.equal(c.items, null); assert.equal(c.owners, null)
  assert.deepEqual(c.volume24h, { value: 0, symbol: 'ETH' })
  assert.equal(c.cover, null); assert.equal(c.networkId, null); assert.equal(c.creator, null); assert.equal(c.description, null)
  assert.equal(parseCollectionDetailResponse(payload(dto())).collection.creator, '0x1234…5678')
})

test('client parse: unusable payloads throw malformed', () => {
  for (const bad of [null, {}, payload(null), payload(dto({ name: '' })), payload(dto({ openseaUrl: 'http://x' })), { ...payload(dto()), source: 'other' }]) {
    assert.throws(() => parseCollectionDetailResponse(bad), (e: unknown) => e instanceof CollectionDetailError && e.kind === 'malformed')
  }
})

const jsonRes = (body: unknown, status = 200, type = 'application/json') => new Response(JSON.stringify(body), { status, headers: { 'content-type': type } })

test('client fetch: requests by slug, caches, shares in-flight, forceRefresh bypasses', async () => {
  let n = 0
  const urls: string[] = []
  const fetchImpl = (async (input: string | URL | Request) => { n++; urls.push(String(input)); return jsonRes(payload(dto())) }) as typeof fetch
  await Promise.all([fetchLiveCollection('Azuki', { fetchImpl }), fetchLiveCollection('azuki', { fetchImpl })])
  assert.equal(n, 1)
  await fetchLiveCollection('azuki', { fetchImpl })
  assert.equal(n, 1)
  await fetchLiveCollection('azuki', { fetchImpl, forceRefresh: true })
  assert.equal(n, 2)
  assert.equal(urls[0], '/api/collection?slug=azuki')
})

test('client fetch: error mapping (not-found, proxy-missing, not-configured, 429, invalid slug)', async () => {
  const kind = async (fetchImpl: typeof fetch, slug = 'x') => {
    resetCollectionDetailClientCache()
    try { await fetchLiveCollection(slug, { fetchImpl }) } catch (e) { return e instanceof CollectionDetailError ? e.kind : 'other' }
    return 'none'
  }
  assert.equal(await kind((async () => jsonRes({ error: 'not-found' }, 404)) as typeof fetch), 'not-found')
  assert.equal(await kind((async () => jsonRes({ error: 'not-configured' }, 503)) as typeof fetch), 'not-configured')
  assert.equal(await kind((async () => jsonRes({ error: 'upstream-auth' }, 502)) as typeof fetch), 'upstream-auth')
  assert.equal(await kind((async () => jsonRes({ error: 'rate-limited' }, 429)) as typeof fetch), 'rate-limited')
  assert.equal(await kind((async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch), 'proxy-missing')
  assert.equal(await kind((async () => new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } })) as typeof fetch), 'proxy-missing')
  assert.equal(await kind((async () => { throw new TypeError('offline') }) as typeof fetch), 'network')
  assert.equal(await kind((async () => jsonRes({})) as typeof fetch, '../bad'), 'invalid-slug')
  assert.match(collectionDetailErrorMessage('not-found'), /no collection/)
})

test('round trip: proxy output parses on the client with every section intact', async () => {
  const res = await handleCollection(get('azuki'), { apiKey: KEY, fetchImpl: upstream().impl })
  const snap = parseCollectionDetailResponse(await res.json())
  const c = snap.collection
  assert.deepEqual(snap.unavailable, [])
  assert.equal(c.networkId, 'ethereum'); assert.equal(c.verified, true); assert.equal(c.sales24h, 4)
  assert.deepEqual(c.stats?.totalVolume, { value: 900, symbol: 'ETH' })
  assert.deepEqual(c.stats?.intervals.oneDay?.volumeDiff, { value: -5, symbol: 'ETH' })
  assert.equal(c.stats?.intervals.sevenDay?.salesDiff, -3)
  assert.equal(c.traits?.categories[0].values[0].value, 'Blue')
  assert.equal(c.sampleItems[0].image, 'https://i.example/1.png'); assert.equal(c.sampleItems[1].image, null)
  assert.deepEqual(c.contracts, [{ address: '0xabc', networkId: 'ethereum' }])
  assert.deepEqual(c.fees, [{ fee: 2.5, required: true, recipient: '0xfee' }])
  assert.equal(c.links.projectUrl, 'https://azuki.com'); assert.equal(c.links.twitterUrl, 'https://x.com/azuki')
  assert.equal(c.links.wikiUrl, null); assert.equal(c.links.instagramUrl, null)
  assert.equal(c.createdDate, '2022-01-02T00:00:00')
})

test('client parse: hostile optional sections degrade to empty instead of throwing', () => {
  const s = parseCollectionDetailResponse({ source: 'opensea', fetchedAt: 1, partial: true, unavailable: ['traits', 'bogus'], collection: {
    slug: 'a', name: 'A', openseaUrl: 'https://opensea.io/collection/a', stats: 'x', traits: { categories: [{ name: 'T', values: [{ value: 'v', count: -1 }] }] },
    sampleItems: [{ identifier: '' }, 5], contracts: 'no', fees: [{ fee: -1 }], links: { twitterUsername: 'bad handle', projectUrl: 'javascript:alert(1)' },
  } })
  assert.deepEqual(s.unavailable, ['traits'])
  assert.equal(s.collection.stats, null); assert.equal(s.collection.traits, null)
  assert.deepEqual(s.collection.sampleItems, []); assert.deepEqual(s.collection.contracts, []); assert.deepEqual(s.collection.fees, [])
  assert.equal(s.collection.links.twitterUrl, null); assert.equal(s.collection.links.projectUrl, null)
})
