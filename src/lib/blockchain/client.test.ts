import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBlockchainClient } from './client.ts'

type Handler = (url: string, method: string, params: unknown[]) => { status?: number; body?: unknown; text?: string } | 'hang'

function makeFetch(handler: Handler) {
  const calls: Array<{ url: string; method: string }> = []
  const impl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const payload = JSON.parse(String(init?.body)) as { method: string; params: unknown[] }
    calls.push({ url, method: payload.method })
    const out = handler(url, payload.method, payload.params)
    if (out === 'hang') {
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    }
    const text = out.text ?? JSON.stringify(out.body)
    return Promise.resolve(new Response(text, { status: out.status ?? 200 }))
  }) as typeof fetch
  return { impl, calls }
}

const ok = (result: unknown) => ({ body: { jsonrpc: '2.0', id: 1, result } })
const healthy = (chainHex: string): Handler => (_u, method) => {
  if (method === 'eth_chainId') return ok(chainHex)
  if (method === 'eth_blockNumber') return ok('0x64')
  if (method === 'eth_gasPrice') return ok('0x3b9aca00')
  if (method === 'eth_getBalance') return ok('0xde0b6b3a7640000')
  return { body: { error: { code: -32601, message: 'nope' } } }
}

test('snapshot is normalised and carries provenance', async () => {
  const { impl } = makeFetch(healthy('0x1'))
  const client = createBlockchainClient({ fetch: impl, now: () => 5000 })
  const result = await client.getChainSnapshot(1)
  assert.equal(result.status, 'ok')
  if (result.status !== 'ok') return
  assert.deepEqual(result.data, { chainId: 1, blockNumber: 100, gasPriceWei: '1000000000', gasPriceGwei: '1' })
  assert.equal(result.provenance.networkName, 'Ethereum Mainnet')
  assert.equal(result.provenance.source, 'publicnode-ethereum')
  assert.equal(result.provenance.retrievedAt, 5000)
  assert.equal(result.provenance.fromCache, false)
  assert.equal(result.provenance.stale, false)
  assert.equal(result.provenance.endpointChainMatched, true)
  assert.deepEqual(result.provenance.fallbackFrom, [])
})

test('unsupported networks and invalid addresses fail without any request', async () => {
  const { impl, calls } = makeFetch(healthy('0x1'))
  const client = createBlockchainClient({ fetch: impl })
  const a = await client.getChainSnapshot(56)
  assert.equal(a.status === 'unavailable' && a.error.kind, 'unsupported-network')
  const b = await client.getNativeBalance(1, '0x123')
  assert.equal(b.status === 'unavailable' && b.error.kind, 'invalid-input')
  assert.equal(calls.length, 0)
})

test('falls back to the next provider and records which one failed, without merging', async () => {
  const { impl } = makeFetch((url, method, params) => url.includes('publicnode') ? { status: 503, text: 'down' } : healthy('0x1')(url, method, params))
  const client = createBlockchainClient({ fetch: impl })
  const result = await client.getChainSnapshot(1)
  assert.equal(result.status, 'ok')
  if (result.status !== 'ok') return
  assert.equal(result.provenance.source, 'drpc-ethereum')
  assert.deepEqual(result.provenance.fallbackFrom, ['publicnode-ethereum'])
})

test('a provider answering for the wrong chain is rejected', async () => {
  const { impl } = makeFetch((url, method, params) => url.includes('publicnode') ? healthy('0x89')(url, method, params) : healthy('0x1')(url, method, params))
  const client = createBlockchainClient({ fetch: impl })
  const result = await client.getChainSnapshot(1)
  assert.equal(result.status === 'ok' && result.provenance.source, 'drpc-ethereum')
})

test('error classification: rate limit, malformed, timeout, network, rpc', async () => {
  const cases: Array<[string, Handler, string]> = [
    ['rate-limited', () => ({ status: 429, text: '' }), 'rate-limited'],
    ['rate-limited (rpc error)', () => ({ body: { error: { code: -32005, message: 'limit exceeded' } } }), 'rate-limited'],
    ['malformed json', () => ({ text: '<html>' }), 'malformed'],
    ['missing result', () => ({ body: { jsonrpc: '2.0', id: 1 } }), 'malformed'],
    ['bad quantity', (_u, m) => ok(m === 'eth_chainId' ? '0x1' : 'zzz'), 'malformed'],
    ['http', () => ({ status: 500, text: '' }), 'http'],
    ['rpc', () => ({ body: { error: { code: -32602, message: 'invalid params' } } }), 'rpc'],
  ]
  for (const [label, handler, expected] of cases) {
    const { impl } = makeFetch(handler)
    const client = createBlockchainClient({ fetch: impl })
    const result = await client.getChainSnapshot(8453)
    assert.equal(result.status === 'unavailable' && result.error.kind, expected, label)
    if (result.status === 'unavailable') assert.ok(!/https?:\/\//.test(JSON.stringify(result.error)), 'error info must not leak URLs')
  }
  const networkFail = createBlockchainClient({ fetch: (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch })
  const n = await networkFail.getChainSnapshot(8453)
  assert.equal(n.status === 'unavailable' && n.error.kind, 'network')
  const hang = makeFetch(() => 'hang')
  const timeoutClient = createBlockchainClient({ fetch: hang.impl, timeoutMs: 20 })
  const t = await timeoutClient.getChainSnapshot(8453)
  assert.equal(t.status === 'unavailable' && t.error.kind, 'timeout')
})

test('a deterministic rpc error does not fall through to other providers', async () => {
  const { impl, calls } = makeFetch(() => ({ body: { error: { code: -32602, message: 'invalid params' } } }))
  const client = createBlockchainClient({ fetch: impl })
  await client.getChainSnapshot(1)
  assert.equal(new Set(calls.map((c) => c.url)).size, 1)
})

test('fresh cache avoids network; expired data is refetched', async () => {
  let clock = 0
  const { impl, calls } = makeFetch(healthy('0x1'))
  const client = createBlockchainClient({ fetch: impl, now: () => clock })
  await client.getChainSnapshot(1)
  const after = calls.length
  clock = 10_000
  const cached = await client.getChainSnapshot(1)
  assert.equal(calls.length, after)
  assert.equal(cached.status === 'ok' && cached.provenance.fromCache, true)
  assert.equal(cached.status === 'ok' && cached.provenance.stale, false)
  assert.equal(cached.status === 'ok' && cached.provenance.ageMs, 10_000)
  clock = 20_000
  await client.getChainSnapshot(1)
  assert.ok(calls.length > after)
})

test('stale data is served and flagged only when refresh fails; it expires after maxStale', async () => {
  let clock = 0
  let down = false
  const { impl } = makeFetch((u, m, p) => down ? { status: 503, text: '' } : healthy('0x1')(u, m, p))
  const client = createBlockchainClient({ fetch: impl, now: () => clock, cooldownMs: {} })
  await client.getChainSnapshot(1)
  down = true
  clock = 60_000
  const stale = await client.getChainSnapshot(1)
  assert.equal(stale.status, 'ok')
  if (stale.status === 'ok') {
    assert.equal(stale.provenance.stale, true)
    assert.equal(stale.provenance.fromCache, true)
    assert.equal(stale.refreshError?.kind, 'http')
  }
  clock = 10 * 60_000
  const gone = await client.getChainSnapshot(1)
  assert.equal(gone.status, 'unavailable')
})

test('concurrent identical requests share one network fetch', async () => {
  const { impl, calls } = makeFetch(healthy('0x1'))
  const client = createBlockchainClient({ fetch: impl })
  const [a, b, c] = await Promise.all([client.getChainSnapshot(1), client.getChainSnapshot(1), client.getChainSnapshot(1)])
  assert.ok([a, b, c].every((r) => r.status === 'ok'))
  assert.equal(calls.filter((x) => x.method === 'eth_blockNumber').length, 1)
})

test('aborting a caller returns aborted and cancels the shared request when nobody is left', async () => {
  const { impl } = makeFetch(() => 'hang')
  const client = createBlockchainClient({ fetch: impl, timeoutMs: 5000 })
  const controller = new AbortController()
  const pending = client.getChainSnapshot(1, { signal: controller.signal })
  controller.abort()
  const result = await pending
  assert.equal(result.status === 'unavailable' && result.error.kind, 'aborted')
  const pre = new AbortController()
  pre.abort()
  const early = await client.getChainSnapshot(1, { signal: pre.signal })
  assert.equal(early.status === 'unavailable' && early.error.kind, 'aborted')
})

test('failing providers enter a cooldown instead of being hammered', async () => {
  let clock = 0
  const { impl, calls } = makeFetch(() => ({ status: 429, text: '' }))
  const client = createBlockchainClient({ fetch: impl, now: () => clock })
  await client.getChainSnapshot(8453)
  const first = calls.length
  clock = 1000
  const again = await client.getChainSnapshot(8453, { forceRefresh: true })
  assert.equal(calls.length, first, 'no new requests during cooldown')
  assert.equal(again.status === 'unavailable' && again.error.kind, 'cooldown')
  clock = 120_000
  await client.getChainSnapshot(8453, { forceRefresh: true })
  assert.ok(calls.length > first)
})

test('native balance is normalised and keyed per address', async () => {
  const { impl, calls } = makeFetch(healthy('0xa4b1'))
  const client = createBlockchainClient({ fetch: impl })
  const addr = '0x' + 'AB'.repeat(20)
  const result = await client.getNativeBalance(42161, addr)
  assert.equal(result.status, 'ok')
  if (result.status === 'ok') {
    assert.equal(result.data.address, addr.toLowerCase())
    assert.equal(result.data.balanceFormatted, '1')
    assert.equal(result.data.symbol, 'ETH')
  }
  assert.ok(calls.some((c) => c.method === 'eth_getBalance'))
})

test('forced refresh inside the minimum interval is answered from cache', async () => {
  const { impl, calls } = makeFetch(healthy('0x1'))
  const client = createBlockchainClient({ fetch: impl, now: () => 100 })
  await client.getChainSnapshot(1)
  const n = calls.length
  await client.getChainSnapshot(1, { forceRefresh: true })
  assert.equal(calls.length, n)
})
