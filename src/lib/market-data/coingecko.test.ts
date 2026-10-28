import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyQuotes, fetchMarketSnapshot, MarketDataError, parseMarkets } from './coingecko.ts'
import type { Token } from '../../data/types.ts'

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id, current_price: 10, market_cap: 1000, total_volume: 100, price_change_percentage_24h: -1.5,
  last_updated: '2026-10-21T04:00:00.000Z', sparkline_in_7d: { price: Array.from({ length: 168 }, (_, i) => i + 1) }, ...over,
})
const tok = (id: string): Token => ({ id, ticker: id.toUpperCase(), name: id, networkId: 'ethereum', price: 1, change24h: 0, marketCap: 1, volume24h: 1, sparkline: [1], description: '', demoNote: 'x' })

test('parses complete rows, downsamples sparkline', () => {
  const s = parseMarkets([row('bitcoin'), row('ethereum')], 5)
  assert.equal(s.quotes.btc.price, 10)
  assert.equal(s.quotes.btc.sparkline.length, 28)
  assert.equal(s.quotes.btc.sparkline[0], 1)
  assert.equal(s.quotes.btc.sparkline[27], 168)
  assert.ok(s.unavailableIds.includes('sol'))
})

test('null fields make a token unavailable, never fabricated', () => {
  const s = parseMarkets([row('bitcoin'), row('ethereum', { price_change_percentage_24h: null })], 5)
  assert.ok(s.quotes.btc)
  assert.equal(s.quotes.eth, undefined)
  assert.ok(s.unavailableIds.includes('eth'))
})

test('rejects non-array and empty payloads', () => {
  assert.throws(() => parseMarkets({}, 1), MarketDataError)
  assert.throws(() => parseMarkets([], 1), MarketDataError)
})

test('applyQuotes overlays live figures and excludes unquoted tokens', () => {
  const s = parseMarkets([row('bitcoin')], 5)
  const { live, excluded } = applyQuotes([tok('btc'), tok('nex')], s)
  assert.equal(live.length, 1)
  assert.equal(live[0].price, 10)
  assert.equal(live[0].demoNote, undefined)
  assert.deepEqual(excluded.map((t) => t.id), ['nex'])
})

test('fetch classifies 429 and HTTP errors; caches success', async () => {
  const mk = (status: number, body: unknown = []) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch
  await assert.rejects(fetchMarketSnapshot({ fetchImpl: mk(429), forceRefresh: true }), { kind: 'rate-limited' })
  await assert.rejects(fetchMarketSnapshot({ fetchImpl: mk(500), forceRefresh: true }), { kind: 'http' })
  let calls = 0
  const ok = (async () => { calls++; return new Response(JSON.stringify([row('bitcoin')]), { status: 200 }) }) as typeof fetch
  await fetchMarketSnapshot({ fetchImpl: ok, forceRefresh: true })
  await fetchMarketSnapshot({ fetchImpl: ok })
  assert.equal(calls, 1)
})

test('aborting one caller does not cancel the shared request (StrictMode double-effect)', async () => {
  let calls = 0
  let fetchSignal: AbortSignal | undefined
  const slow = ((_url: string, init?: RequestInit) => {
    calls++
    fetchSignal = init?.signal ?? undefined
    return new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      setTimeout(() => resolve(new Response(JSON.stringify([row('bitcoin')]), { status: 200 })), 20)
    })
  }) as unknown as typeof fetch
  const first = new AbortController()
  const a = fetchMarketSnapshot({ fetchImpl: slow, forceRefresh: true, signal: first.signal })
  first.abort() // effect cleanup
  const b = fetchMarketSnapshot({ fetchImpl: slow, signal: new AbortController().signal }) // effect re-run
  await assert.rejects(a, { kind: 'aborted' })
  const snap = await b
  assert.ok(snap.quotes.btc)
  assert.equal(calls, 1)
  assert.equal(fetchSignal?.aborted, false)
})
