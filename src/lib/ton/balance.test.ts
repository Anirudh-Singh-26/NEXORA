import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchTonTestnetBalance, resolveTonTestnetApiBase, TON_TESTNET_API_URL, TonBalanceError } from './balance.ts'

const ADDRESS = `0:${'ab'.repeat(32)}`

function respond(status: number, body: unknown, raw = false): typeof fetch {
  return (async () => new Response(raw ? String(body) : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch
}

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof TonBalanceError) return error.kind
    throw error
  }
  return 'resolved'
}

test('default endpoint is the public TON Center testnet API', () => {
  assert.equal(TON_TESTNET_API_URL, 'https://testnet.toncenter.com/api/v2')
  assert.deepEqual(resolveTonTestnetApiBase(undefined), { ok: true, base: TON_TESTNET_API_URL, custom: false })
  assert.deepEqual(resolveTonTestnetApiBase('  '), { ok: true, base: TON_TESTNET_API_URL, custom: false })
})

test('resolveTonTestnetApiBase accepts a custom https base and trims trailing slashes', () => {
  assert.deepEqual(resolveTonTestnetApiBase('https://ton-proxy.example.org/testnet/api/v2/'), { ok: true, base: 'https://ton-proxy.example.org/testnet/api/v2', custom: true })
  assert.deepEqual(resolveTonTestnetApiBase('http://localhost:8787/ton'), { ok: true, base: 'http://localhost:8787/ton', custom: true })
})

test('resolveTonTestnetApiBase rejects unsafe or mainnet configuration', () => {
  for (const value of ['not a url', 'ftp://x.example/api', 'http://example.org/api', 'https://user:pw@example.org/api', 'https://example.org/api?api_key=SECRET', 'https://example.org/api#frag', 'https://toncenter.com/api/v2', 'https://www.toncenter.com/api/v2']) {
    assert.equal(resolveTonTestnetApiBase(value).ok, false, value)
  }
})

test('fetchTonTestnetBalance requests getAddressBalance with the raw address and no credentials', async () => {
  let seenUrl = ''
  let seenInit: RequestInit | undefined
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    seenUrl = String(url)
    seenInit = init
    return new Response(JSON.stringify({ ok: true, result: '1500000000' }), { status: 200 })
  }) as typeof fetch
  const balance = await fetchTonTestnetBalance(ADDRESS, { fetchImpl, now: () => 1234 })
  assert.equal(balance.nano, 1_500_000_000n)
  assert.equal(balance.address, ADDRESS)
  assert.equal(balance.retrievedAt, 1234)
  assert.equal(seenUrl, `${TON_TESTNET_API_URL}/getAddressBalance?address=${encodeURIComponent(ADDRESS)}`)
  assert.equal(seenInit?.method, 'GET')
  assert.equal(seenInit?.credentials, 'omit')
  assert.ok(!JSON.stringify(seenInit?.headers).toLowerCase().includes('api-key'))
})

test('fetchTonTestnetBalance uses the configured base', async () => {
  let seenUrl = ''
  const fetchImpl = (async (url: string | URL | Request) => { seenUrl = String(url); return new Response('{"ok":true,"result":"0"}', { status: 200 }) }) as typeof fetch
  const balance = await fetchTonTestnetBalance(ADDRESS, { fetchImpl, base: 'https://ton-proxy.example.org/v2' })
  assert.equal(balance.nano, 0n)
  assert.ok(seenUrl.startsWith('https://ton-proxy.example.org/v2/getAddressBalance?address='))
})

test('fetchTonTestnetBalance keeps exact precision for amounts above 2^53', async () => {
  const balance = await fetchTonTestnetBalance(ADDRESS, { fetchImpl: respond(200, { ok: true, result: '9007199254740993' }) })
  assert.equal(balance.nano, 9_007_199_254_740_993n)
})

test('fetchTonTestnetBalance refuses a malformed address without making a request', async () => {
  let called = false
  const fetchImpl = (async () => { called = true; return new Response('{}') }) as typeof fetch
  assert.equal(await kindOf(fetchTonTestnetBalance('EQ-not-raw', { fetchImpl })), 'invalid-address')
  assert.equal(called, false)
})

test('fetchTonTestnetBalance rejects invalid or unexpected responses', async () => {
  const bodies: unknown[] = [
    { ok: true }, { ok: true, result: null }, { ok: true, result: '-5' }, { ok: true, result: '1.5' }, { ok: true, result: '1e9' }, { ok: true, result: '' },
    { ok: true, result: 1.5 }, { ok: true, result: Number.MAX_SAFE_INTEGER + 1 }, { ok: true, result: { balance: '1' } }, { ok: false, result: '5' }, { result: '5' }, [], 'text', 7, null,
  ]
  for (const body of bodies) assert.equal(await kindOf(fetchTonTestnetBalance(ADDRESS, { fetchImpl: respond(200, body) })), 'bad-response', JSON.stringify(body))
  assert.equal(await kindOf(fetchTonTestnetBalance(ADDRESS, { fetchImpl: respond(200, '<html>', true) })), 'bad-response')
})

test('fetchTonTestnetBalance maps HTTP failures', async () => {
  assert.equal(await kindOf(fetchTonTestnetBalance(ADDRESS, { fetchImpl: respond(429, { ok: false }) })), 'rate-limited')
  assert.equal(await kindOf(fetchTonTestnetBalance(ADDRESS, { fetchImpl: respond(200, { ok: false, code: 429, error: 'Ratelimit exceed' }) })), 'rate-limited')
  assert.equal(await kindOf(fetchTonTestnetBalance(ADDRESS, { fetchImpl: respond(401, { ok: false }) })), 'auth')
  assert.equal(await kindOf(fetchTonTestnetBalance(ADDRESS, { fetchImpl: respond(403, { ok: false }) })), 'auth')
  assert.equal(await kindOf(fetchTonTestnetBalance(ADDRESS, { fetchImpl: respond(503, { ok: false }) })), 'http')
})

test('fetchTonTestnetBalance maps network failures and rethrows aborts', async () => {
  const failing = (async () => { throw new TypeError('Failed to fetch') }) as typeof fetch
  assert.equal(await kindOf(fetchTonTestnetBalance(ADDRESS, { fetchImpl: failing })), 'network')
  const aborting = (async () => { throw new DOMException('aborted', 'AbortError') }) as typeof fetch
  await assert.rejects(fetchTonTestnetBalance(ADDRESS, { fetchImpl: aborting }), (error: unknown) => error instanceof DOMException && error.name === 'AbortError')
})
