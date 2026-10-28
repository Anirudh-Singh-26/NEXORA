import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { handleCollectionActivity, resetActivityCache } from '../../../api/collection-activity.ts'
import { handleCollectionItems, resetItemsCache } from '../../../api/collection-items.ts'
import { CollectionDetailError } from './collection-detail.ts'
import { fetchActivityPage, fetchItemsPage, itemPrice, listingDepth, parseActivityResponse, parseItemsResponse, resetExtrasClientCache, sortItemsByPrice, type LiveItem } from './collection-extras.ts'

const json = (body: unknown, status = 200, type = 'application/json') => new Response(JSON.stringify(body), { status, headers: { 'content-type': type } })
const itemsPayload = (over: Record<string, unknown> = {}) => ({
  source: 'opensea', slug: 'credits', fetchedAt: 123, next: 'c1',
  items: [{ identifier: '1', name: 'A', imageUrl: 'https://i/1.png', contract: '0xc' }, { identifier: '1' }, { identifier: '2', name: null, imageUrl: 'http://insecure/2.png' }, { name: 'no id' }],
  listings: { '1': { value: 0.5, symbol: 'ETH' }, '2': { value: 0, symbol: 'ETH' }, '3': { value: 1 } },
  lastSales: { '2': { value: 2, symbol: 'ETH' } }, unavailable: ['listings', 'bogus'], ...over,
})
const item = (id: string): LiveItem => ({ identifier: id, name: null, image: null, contract: null })

beforeEach(() => { resetExtrasClientCache(); resetItemsCache(); resetActivityCache() })

test('parseItemsResponse validates field by field', () => {
  const p = parseItemsResponse(itemsPayload())
  assert.deepEqual(p.items.map((i) => i.identifier), ['1', '2'])
  assert.equal(p.items[1].image, null)
  assert.deepEqual(p.listings, { '1': { value: 0.5, symbol: 'ETH' } })
  assert.deepEqual(p.lastSales, { '2': { value: 2, symbol: 'ETH' } })
  assert.deepEqual(p.unavailable, ['listings'])
  assert.equal(p.next, 'c1')
  assert.throws(() => parseItemsResponse({ source: 'x' }), (e: unknown) => e instanceof CollectionDetailError && e.kind === 'malformed')
  assert.throws(() => parseItemsResponse(itemsPayload({ slug: '' })), /Missing slug/)
})

test('parseActivityResponse: drops duplicates, bad prices, keeps type', () => {
  const p = parseActivityResponse({
    source: 'opensea', slug: 'credits', type: 'sale', fetchedAt: 1, next: null,
    events: [{ id: 'a', timestamp: 10, identifier: '1', price: { value: 1, symbol: 'ETH' }, from: '0xa', to: '0xb' }, { id: 'a' }, { id: 'b', price: { value: -1, symbol: 'ETH' }, imageUrl: 'http://x' }, { nope: 1 }],
  })
  assert.deepEqual(p.events.map((e) => e.id), ['a', 'b'])
  assert.equal(p.events[1].price, null); assert.equal(p.events[1].image, null)
  assert.equal(p.type, 'sale')
  assert.throws(() => parseActivityResponse({ source: 'opensea', slug: 's', type: 'mint', events: [], fetchedAt: 1 }), /malformed|Missing/)
})

test('itemPrice prefers an active listing, then last sale, else null — never a zero', () => {
  const l = { '1': { value: 1, symbol: 'ETH' } }, s = { '1': { value: 9, symbol: 'ETH' }, '2': { value: 3, symbol: 'ETH' } }
  assert.deepEqual(itemPrice(item('1'), l, s), { kind: 'listed', amount: { value: 1, symbol: 'ETH' } })
  assert.deepEqual(itemPrice(item('2'), l, s), { kind: 'sold', amount: { value: 3, symbol: 'ETH' } })
  assert.equal(itemPrice(item('3'), l, s), null)
})

test('sortItemsByPrice sorts only the dominant currency; unpriced / other-currency items keep order after', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map(item)
  const listings = { a: { value: 5, symbol: 'ETH' }, b: { value: 1, symbol: 'ETH' }, c: { value: 9, symbol: 'USDC' }, e: { value: 3, symbol: 'ETH' } }
  assert.deepEqual(sortItemsByPrice(items, listings, {}, 'asc').map((i) => i.identifier), ['b', 'e', 'a', 'c', 'd'])
  assert.deepEqual(sortItemsByPrice(items, listings, {}, 'desc').map((i) => i.identifier), ['a', 'e', 'b', 'c', 'd'])
  assert.deepEqual(sortItemsByPrice(items, {}, {}, 'asc').map((i) => i.identifier), ['a', 'b', 'c', 'd', 'e'])
})

test('listingDepth buckets relative to the cheapest listing; null when too few to chart', () => {
  assert.equal(listingDepth({ a: { value: 1, symbol: 'ETH' }, b: { value: 2, symbol: 'ETH' } }), null)
  const d = listingDepth({ a: { value: 1, symbol: 'ETH' }, b: { value: 1.04, symbol: 'ETH' }, c: { value: 1.2, symbol: 'ETH' }, d: { value: 3, symbol: 'ETH' }, e: { value: 7, symbol: 'USDC' } })
  assert.ok(d)
  assert.equal(d.symbol, 'ETH'); assert.equal(d.total, 4)
  assert.deepEqual(d.buckets.map((b) => b.count), [2, 0, 1, 0, 0, 1])
})

test('client cache: one request per URL within the TTL, forceRefresh bypasses, cursor is part of the key', async () => {
  let n = 0
  const fetchImpl = (async () => { n += 1; return json(itemsPayload()) }) as typeof fetch
  await fetchItemsPage('Credits', { fetchImpl, now: () => 0 })
  await fetchItemsPage('credits', { fetchImpl, now: () => 1000 })
  assert.equal(n, 1)
  await fetchItemsPage('credits', { fetchImpl, now: () => 1000, next: 'c1' })
  assert.equal(n, 2)
  await fetchItemsPage('credits', { fetchImpl, now: () => 1000, forceRefresh: true })
  assert.equal(n, 3)
  await fetchItemsPage('credits', { fetchImpl, now: () => 10 * 60_000 })
  assert.equal(n, 4)
})

test('client error mapping: proxy missing (SPA html), not-configured, rate limit, bad slug, abort', async () => {
  const kind = async (p: Promise<unknown>) => { try { await p; return 'ok' } catch (e) { return e instanceof CollectionDetailError ? e.kind : 'other' } }
  assert.equal(await kind(fetchItemsPage('x', { fetchImpl: (async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch })), 'proxy-missing')
  assert.equal(await kind(fetchItemsPage('x', { fetchImpl: (async () => json({ error: 'not-configured' }, 503)) as typeof fetch })), 'not-configured')
  assert.equal(await kind(fetchActivityPage('y', 'sale', { fetchImpl: (async () => json({ error: 'rate-limited' }, 429)) as typeof fetch })), 'rate-limited')
  assert.equal(await kind(fetchItemsPage('../x')), 'invalid-slug')
  const c = new AbortController(); c.abort()
  assert.equal(await kind(fetchItemsPage('z', { signal: c.signal, fetchImpl: (async () => json(itemsPayload())) as typeof fetch })), 'aborted')
})

test('round trip: proxy handlers → client parsers (key stays server side)', async () => {
  const KEY = 'round-trip-key'
  const ETH = 10n ** 18n
  const upstream = (async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes('/nfts')) return json({ nfts: [{ identifier: '7', name: 'Seven', image_url: 'https://i/7.png', contract: '0xc' }], next: 'nx' })
    if (url.includes('/listings/')) return json({ listings: [{ price: { current: { currency: 'ETH', decimals: 18, value: (ETH / 5n).toString() } }, protocol_data: { parameters: { offer: [{ identifierOrCriteria: '7' }] } } }] })
    return json({ asset_events: [{ event_type: 'sale', event_timestamp: 100, transaction: '0xt', quantity: 1, payment: { quantity: ETH.toString(), decimals: 18, symbol: 'ETH' }, seller: '0xs', buyer: '0xb', nft: { identifier: '7', name: 'Seven', image_url: 'https://i/7.png' } }], next: null })
  }) as typeof fetch
  const via = (handler: (r: Request, o: { apiKey: string; fetchImpl: typeof fetch }) => Promise<Response>) => (async (url: string) => {
    const res = await handler(new Request(`http://localhost${url}`), { apiKey: KEY, fetchImpl: upstream })
    assert.ok(!(await res.clone().text()).includes(KEY))
    return res
  }) as unknown as typeof fetch
  const items = await fetchItemsPage('credits', { fetchImpl: via(handleCollectionItems) })
  assert.equal(items.items[0].identifier, '7')
  assert.deepEqual(items.listings, { '7': { value: 0.2, symbol: 'ETH' } })
  assert.deepEqual(items.lastSales, { '7': { value: 1, symbol: 'ETH' } })
  assert.equal(items.next, 'nx')
  const act = await fetchActivityPage('credits', 'sale', { fetchImpl: via(handleCollectionActivity) })
  assert.equal(act.events[0].price?.value, 1); assert.equal(act.events[0].timestamp, 100_000)
})
