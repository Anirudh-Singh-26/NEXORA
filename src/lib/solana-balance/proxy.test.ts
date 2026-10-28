import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GET, handleSolanaBalance, parseLamports } from '../../../api/solana-balance.ts'

const KEY = 'test-secret-key-123'
const ADDR = 'So11111111111111111111111111111111111111112'
const req = (query: string, method = 'GET') => new Request(`http://localhost/api/solana-balance?${query}`, { method })
const good = `address=${ADDR}`

interface Call { url: string; body: { method?: string; params?: unknown[] } }
function upstream(respond: (call: Call) => { status?: number; text?: string; body?: unknown } | 'throw') {
  const calls: Call[] = []
  const impl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), body: JSON.parse(String(init?.body)) as Call['body'] }
    calls.push(call)
    const out = respond(call)
    if (out === 'throw') return Promise.reject(new TypeError(`fetch failed for ${call.url}`))
    return Promise.resolve(new Response(out.text ?? JSON.stringify(out.body ?? {}), { status: out.status ?? 200 }))
  }) as typeof fetch
  return { impl, calls }
}
const balance = (value: number | string) => ({ text: `{"jsonrpc":"2.0","result":{"context":{"slot":1,"apiVersion":"2.0"},"value":${value}},"id":1}` })

test('parseLamports: exact integers, including values above 2^53 that JSON.parse would round', () => {
  assert.equal(parseLamports(balance(0).text), '0')
  assert.equal(parseLamports(balance(1500000000).text), '1500000000')
  assert.equal(parseLamports(balance('9007199254740993').text), '9007199254740993')
  assert.equal(parseLamports(balance('600000000000000000').text), '600000000000000000')
  for (const bad of ['not json', '{}', '{"result":{"value":"5"}}', '{"result":{"value":-1}}', '{"result":{"value":1.5}}', '{"result":{"value":null}}', '{"result":{"value":99999999999999999999999}}']) {
    assert.throws(() => parseLamports(bad), `should reject ${bad}`)
  }
})

test('success: calls Alchemy Solana Devnet getBalance with the address and returns exact lamports', async () => {
  const up = upstream(() => balance('9007199254740993'))
  const response = await handleSolanaBalance(req(good), { apiKey: KEY, fetchImpl: up.impl })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(await response.json(), { address: ADDR, lamports: '9007199254740993', provider: 'alchemy' })
  assert.equal(up.calls.length, 1)
  assert.ok(up.calls[0].url.startsWith('https://solana-devnet.g.alchemy.com/v2/'), `unexpected URL: ${up.calls[0].url}`)
  assert.equal(up.calls[0].body.method, 'getBalance')
  assert.equal(up.calls[0].body.params?.[0], ADDR)
})

test('validation: only GET, rejects malformed addresses before any upstream call', async () => {
  const up = upstream(() => balance(1))
  assert.equal((await handleSolanaBalance(req(good, 'POST'), { apiKey: KEY, fetchImpl: up.impl })).status, 405)
  for (const query of ['', 'address=', 'address=0x' + 'a'.repeat(40), `address=${ADDR}1`, `address=${ADDR.slice(1)}`, `address=${ADDR}&address=${ADDR}x`, 'address=' + encodeURIComponent(`${ADDR}\n`), 'address=' + 'A'.repeat(50)]) {
    const r = await handleSolanaBalance(req(query), { apiKey: KEY, fetchImpl: up.impl })
    assert.equal(r.status, 400, `should reject ${query}`)
  }
  assert.equal(up.calls.length, 0)
})

test('provider failures map to fixed errors and never leak the key, URL or raw provider text', async () => {
  const cases: Array<[() => ReturnType<Parameters<typeof upstream>[0]>, number, string]> = [
    [() => ({ status: 429, text: 'Too many requests RAW' }), 429, 'rate-limited'],
    [() => ({ status: 200, text: '{"error":{"code":429,"message":"Your app has exceeded its compute units RAW"}}' }), 429, 'rate-limited'],
    [() => ({ status: 401, text: 'Invalid API key RAW' }), 502, 'provider-auth'],
    [() => ({ status: 403, text: 'RAW' }), 502, 'provider-auth'],
    [() => ({ status: 200, text: '{"error":{"code":-32602,"message":"Invalid param RAW"}}' }), 502, 'upstream'],
    [() => ({ status: 500, text: 'RAW' }), 502, 'upstream'],
    [() => ({ status: 200, text: 'not json RAW' }), 502, 'upstream'],
    [() => ({ status: 200, body: { result: { value: 'abc' } } }), 502, 'upstream'],
    [() => ({ status: 200, body: { result: {} } }), 502, 'upstream'],
  ]
  for (const [respond, status, code] of cases) {
    const response = await handleSolanaBalance(req(good), { apiKey: KEY, fetchImpl: upstream(respond).impl })
    const text = await response.text()
    assert.equal(response.status, status, text)
    assert.equal((JSON.parse(text) as { error: { code: string } }).error.code, code)
    assert.ok(!text.includes(KEY) && !text.includes('RAW') && !text.includes('alchemy.com'), `leaked: ${text}`)
  }
  const thrown = await handleSolanaBalance(req(good), { apiKey: KEY, fetchImpl: upstream(() => 'throw').impl })
  const thrownText = await thrown.text()
  assert.equal(thrown.status, 502)
  assert.ok(!thrownText.includes(KEY) && !thrownText.includes('alchemy.com') && !thrownText.includes('fetch failed'))
})

test('no key configured: uses the public Devnet RPC directly (zero balance is a valid 200)', async () => {
  const up = upstream(() => balance(0))
  const response = await handleSolanaBalance(req(good), { fetchImpl: up.impl })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { address: ADDR, lamports: '0', provider: 'solana-devnet-public' })
  assert.deepEqual(up.calls.map((c) => c.url), ['https://api.devnet.solana.com'])
})

test('Alchemy rejects the key (401/403 or RPC unauthorized): falls back to the public Devnet RPC and never touches mainnet', async () => {
  for (const rejection of [{ status: 403, text: 'RAW' }, { status: 401, text: 'RAW' }, { status: 200, text: '{"error":{"code":-32000,"message":"Unauthorized RAW"}}' }]) {
    const up = upstream((call) => (call.url.includes('alchemy.com') ? rejection : balance(2500000000)))
    const response = await handleSolanaBalance(req(good), { apiKey: KEY, fetchImpl: up.impl })
    const text = await response.text()
    assert.equal(response.status, 200, text)
    assert.deepEqual(JSON.parse(text), { address: ADDR, lamports: '2500000000', provider: 'solana-devnet-public' })
    assert.deepEqual(up.calls.map((c) => c.url), [`https://solana-devnet.g.alchemy.com/v2/${KEY}`, 'https://api.devnet.solana.com'])
    assert.ok(!text.includes(KEY) && !text.includes('RAW'))
    assert.ok(up.calls.every((c) => !/mainnet/i.test(c.url)))
  }
})

test('both providers reject the credentials: provider-auth, no leaks; a rate-limited Alchemy also falls back, and the last error is reported', async () => {
  const both = upstream(() => ({ status: 403, text: 'RAW' }))
  const r = await handleSolanaBalance(req(good), { apiKey: KEY, fetchImpl: both.impl })
  const text = await r.text()
  assert.equal(r.status, 502)
  assert.equal((JSON.parse(text) as { error: { code: string } }).error.code, 'provider-auth')
  assert.ok(!text.includes(KEY) && !text.includes('RAW'))
  assert.equal(both.calls.length, 2)
  const limited = upstream(() => ({ status: 429, text: 'RAW' }))
  assert.equal((await handleSolanaBalance(req(good), { apiKey: KEY, fetchImpl: limited.impl })).status, 429)
  assert.equal(limited.calls.length, 2)
})

test('Vercel GET entry reads ALCHEMY_API_KEY from the server environment only', async () => {
  const saved = process.env.ALCHEMY_API_KEY
  const savedFetch = globalThis.fetch
  const urls: string[] = []
  process.env.ALCHEMY_API_KEY = KEY
  globalThis.fetch = ((input: RequestInfo | URL) => { urls.push(String(input)); return Promise.resolve(new Response(balance(7).text)) }) as typeof fetch
  try {
    const response = await GET(req(good))
    assert.equal(response.status, 200)
    assert.equal(urls[0], `https://solana-devnet.g.alchemy.com/v2/${KEY}`)
  } finally {
    globalThis.fetch = savedFetch
    if (saved === undefined) delete process.env.ALCHEMY_API_KEY
    else process.env.ALCHEMY_API_KEY = saved
  }
})
