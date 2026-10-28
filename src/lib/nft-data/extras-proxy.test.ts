import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { fromBaseUnits } from '../../../api/_opensea-live.ts'
import { handleCollectionActivity, parseEvents, resetActivityCache } from '../../../api/collection-activity.ts'
import { handleCollectionItems, parseBestListings, parseNfts, parseSales, resetItemsCache } from '../../../api/collection-items.ts'

const KEY = 'test-secret-key'
const ETH = 10n ** 18n
const nft = (id: string, over: Record<string, unknown> = {}) => ({ identifier: id, collection: 'c', contract: '0xc0', name: `Item ${id}`, image_url: `https://img.example/${id}.png`, is_disabled: false, is_nsfw: false, ...over })
const listing = (id: string, wei: bigint, currency = 'ETH', decimals = 18) => ({
  order_hash: `0x${id}`, chain: 'ethereum', price: { current: { currency, decimals, value: wei.toString() } },
  protocol_data: { parameters: { offer: [{ itemType: 2, token: '0xc0', identifierOrCriteria: id }] } },
})
const sale = (id: string, wei: bigint, symbol = 'ETH', decimals = 18) => ({
  event_type: 'sale', event_timestamp: 1_760_000_000, transaction: `0xtx${id}`, chain: 'ethereum', quantity: 1,
  payment: { quantity: wei.toString(), token_address: '0x0', decimals, symbol }, seller: '0xseller', buyer: '0xbuyer', nft: nft(id),
})

function router(opts: { nfts?: unknown; listings?: unknown; sales?: unknown; status?: Partial<Record<'nfts' | 'listings' | 'events', number>>; events?: unknown }) {
  const calls: { url: string; key: string | null }[] = []
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, key: new Headers(init?.headers).get('x-api-key') })
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (url.includes('/nfts')) return json(opts.nfts ?? { nfts: [], next: null }, opts.status?.nfts ?? 200)
    if (url.includes('/listings/')) return json(opts.listings ?? { listings: [] }, opts.status?.listings ?? 200)
    if (url.includes('/events/')) {
      const isSale = url.includes('event_type=sale')
      return json((isSale ? opts.sales : opts.events) ?? { asset_events: [] }, opts.status?.events ?? 200)
    }
    return json({}, 404)
  }) as typeof fetch
  return { impl, calls }
}
const req = (path: string, method = 'GET') => new Request(`http://localhost${path}`, { method })

beforeEach(() => { resetItemsCache(); resetActivityCache() })

test('fromBaseUnits converts base units exactly and rejects junk', () => {
  assert.equal(fromBaseUnits((3n * ETH / 2n).toString(), 18), 1.5)
  assert.equal(fromBaseUnits('2500000', 6), 2.5)
  assert.equal(fromBaseUnits('7', 0), 7)
  assert.equal(fromBaseUnits('-5', 18), null)
  assert.equal(fromBaseUnits('1.5', 18), null)
  assert.equal(fromBaseUnits('100', 99), null)
  assert.equal(fromBaseUnits(undefined, 18), null)
})

test('parseNfts: drops NSFW/disabled/duplicate/invalid ids, rejects non-https art, keeps cursor', () => {
  const r = parseNfts({ nfts: [nft('1'), nft('1'), nft('2', { is_nsfw: true }), nft('3', { is_disabled: true }), nft('4', { image_url: 'http://x/y.png' }), nft('bad id!'), nft('5', { display_image_url: 'https://d/5.png' })], next: 'abc_DEF=' })
  assert.deepEqual(r.items.map((i) => i.identifier), ['1', '4', '5'])
  assert.equal(r.items[1].imageUrl, null)
  assert.equal(r.items[2].imageUrl, 'https://d/5.png')
  assert.equal(r.next, 'abc_DEF=')
  assert.equal(parseNfts({ nfts: [], next: 'bad cursor with spaces' }).next, null)
  assert.throws(() => parseNfts({}), /malformed/)
})

test('parseBestListings / parseSales: real prices only, first (cheapest / newest) wins, zero or unknown dropped', () => {
  const l = parseBestListings({ listings: [listing('1', ETH / 2n), listing('1', ETH), listing('2', 0n), listing('3', 3n * ETH, ''), { price: {} }, listing('4', 2_500_000n, 'USDC', 6)] })
  assert.deepEqual(l, { '1': { value: 0.5, symbol: 'ETH' }, '4': { value: 2.5, symbol: 'USDC' } })
  const s = parseSales({ asset_events: [sale('1', ETH), sale('1', 2n * ETH), sale('2', ETH, ''), { event_type: 'transfer', nft: nft('9') }] })
  assert.deepEqual(s, { '1': { value: 1, symbol: 'ETH' } })
})

test('items handler: first page = nfts + listings + sales in 3 key-bearing calls; key never in body; cached; GET only', async () => {
  const { impl, calls } = router({ nfts: { nfts: [nft('1'), nft('2')], next: 'cur1' }, listings: { listings: [listing('1', ETH / 4n)] }, sales: { asset_events: [sale('2', ETH)] } })
  const r = await handleCollectionItems(req('/api/collection-items?slug=Credits'), { apiKey: KEY, fetchImpl: impl, now: () => 1000 })
  assert.equal(r.status, 200)
  const raw = await r.clone().text()
  assert.ok(!raw.includes(KEY))
  const body = await r.json() as Record<string, unknown>
  assert.equal(body.slug, 'credits')
  assert.deepEqual(body.listings, { '1': { value: 0.25, symbol: 'ETH' } })
  assert.deepEqual(body.lastSales, { '2': { value: 1, symbol: 'ETH' } })
  assert.equal(body.next, 'cur1')
  assert.deepEqual(body.unavailable, [])
  assert.equal(calls.length, 3)
  assert.ok(calls.every((c) => c.key === KEY))
  assert.ok(calls[0].url.includes('/collection/credits/nfts') || calls.some((c) => c.url.includes('/collection/credits/nfts')))
  await handleCollectionItems(req('/api/collection-items?slug=credits'), { apiKey: KEY, fetchImpl: impl, now: () => 2000 })
  assert.equal(calls.length, 3) // served from cache
  assert.equal((await handleCollectionItems(req('/api/collection-items?slug=credits', 'POST'), { apiKey: KEY, fetchImpl: impl })).status, 405)
})

test('items handler: later pages skip the price lookups and forward the cursor', async () => {
  const { impl, calls } = router({ nfts: { nfts: [nft('9')], next: null } })
  const r = await handleCollectionItems(req('/api/collection-items?slug=credits&next=cur1'), { apiKey: KEY, fetchImpl: impl })
  assert.equal(calls.length, 1)
  assert.ok(calls[0].url.includes('next=cur1'))
  const body = await r.json() as { next: unknown; listings: unknown }
  assert.equal(body.next, null)
  assert.deepEqual(body.listings, {})
})

test('items handler: a failing optional lookup is reported as unavailable, not as a page failure', async () => {
  const { impl } = router({ nfts: { nfts: [nft('1')], next: null }, status: { listings: 500, events: 429 } })
  const r = await handleCollectionItems(req('/api/collection-items?slug=credits'), { apiKey: KEY, fetchImpl: impl })
  assert.equal(r.status, 200)
  assert.deepEqual((await r.json() as { unavailable: string[] }).unavailable, ['listings', 'sales'])
})

test('items handler: input validation and error mapping', async () => {
  const ok = router({ nfts: { nfts: [], next: null } }).impl
  assert.equal((await handleCollectionItems(req('/api/collection-items?slug=../etc'), { apiKey: KEY, fetchImpl: ok })).status, 400)
  assert.equal((await handleCollectionItems(req('/api/collection-items?slug=a&next=bad%20cursor'), { apiKey: KEY, fetchImpl: ok })).status, 400)
  const missing = await handleCollectionItems(req('/api/collection-items?slug=a'), { apiKey: '', fetchImpl: ok })
  assert.equal(missing.status, 503); assert.deepEqual(await missing.json(), { error: 'not-configured' })
  const code = async (status: number) => { resetItemsCache(); const r = await handleCollectionItems(req('/api/collection-items?slug=a'), { apiKey: KEY, fetchImpl: router({ status: { nfts: status } }).impl }); return [r.status, (await r.json() as { error: string }).error] }
  assert.deepEqual(await code(401), [502, 'upstream-auth'])
  assert.deepEqual(await code(404), [404, 'not-found'])
  assert.deepEqual(await code(429), [429, 'rate-limited'])
  assert.deepEqual(await code(500), [502, 'http'])
})

test('parseEvents: sale/transfer/listing shapes, price conversion, timestamps in ms', () => {
  const sales = parseEvents({ asset_events: [sale('1', ETH / 2n), { event_type: 'sale', transaction: '0xt', nft: nft('2'), payment: null }], next: 'n' }, 'sale')
  assert.equal(sales.events[0].price?.value, 0.5)
  assert.equal(sales.events[0].timestamp, 1_760_000_000_000)
  assert.equal(sales.events[0].from, '0xseller'); assert.equal(sales.events[0].to, '0xbuyer')
  assert.equal(sales.events[1].price, null)
  assert.equal(sales.next, 'n')
  const tr = parseEvents({ asset_events: [{ event_type: 'transfer', event_timestamp: 5, transaction: '0xa', from_address: '0xf', to_address: '0xt', nft: nft('3') }] }, 'transfer')
  assert.equal(tr.events[0].from, '0xf'); assert.equal(tr.events[0].to, '0xt'); assert.equal(tr.events[0].price, null)
  const li = parseEvents({ asset_events: [{ event_type: 'order', event_timestamp: 6, order_hash: '0xh', maker: '0xm', asset: nft('4'), payment: { quantity: ETH.toString(), decimals: 18, symbol: 'ETH' } }] }, 'listing')
  assert.equal(li.events[0].identifier, '4'); assert.equal(li.events[0].price?.value, 1); assert.equal(li.events[0].from, '0xm')
  assert.throws(() => parseEvents({}, 'sale'), /malformed/)
})

test('activity handler: validates type, passes event_type + cursor, never leaks the key', async () => {
  const { impl, calls } = router({ sales: { asset_events: [sale('1', ETH)], next: 'c2' } })
  const r = await handleCollectionActivity(req('/api/collection-activity?slug=credits&type=sale&next=c1'), { apiKey: KEY, fetchImpl: impl })
  assert.equal(r.status, 200)
  assert.ok(!(await r.clone().text()).includes(KEY))
  assert.ok(calls[0].url.includes('event_type=sale') && calls[0].url.includes('next=c1') && calls[0].key === KEY)
  const body = await r.json() as { events: unknown[]; next: string }
  assert.equal(body.events.length, 1); assert.equal(body.next, 'c2')
  assert.equal((await handleCollectionActivity(req('/api/collection-activity?slug=credits&type=mint'), { apiKey: KEY, fetchImpl: impl })).status, 400)
  assert.equal((await handleCollectionActivity(req('/api/collection-activity?slug=%20'), { apiKey: KEY, fetchImpl: impl })).status, 400)
  assert.equal((await handleCollectionActivity(req('/api/collection-activity?slug=a', 'DELETE'), { apiKey: KEY, fetchImpl: impl })).status, 405)
})
