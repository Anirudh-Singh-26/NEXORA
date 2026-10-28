import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { handleWalletTokens, parseTokenBalances, parseTokenMetadata, resetWalletTokensCache } from '../../../api/wallet-tokens.ts'

const KEY = 'test-secret-key-123'
const ADDR = '0xAbCdEf0123456789abcdef0123456789ABCDEF01'
const T1 = '0x' + 'a1'.repeat(20)
const T2 = '0x' + 'b2'.repeat(20)
const T3 = '0x' + 'c3'.repeat(20)
const req = (query: string, method = 'GET') => new Request(`http://localhost/api/wallet-tokens?${query}`, { method })
const good = `chainId=1&address=${ADDR}`

interface Call { url: string; body: unknown }
function upstream(handler: (call: Call) => { status?: number; body?: unknown } | 'throw') {
  const calls: Call[] = []
  const impl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), body: JSON.parse(String(init?.body)) as unknown }
    calls.push(call)
    const out = handler(call)
    if (out === 'throw') return Promise.reject(new TypeError(`fetch failed for ${call.url}`))
    return Promise.resolve(new Response(JSON.stringify(out.body ?? {}), { status: out.status ?? 200 }))
  }) as typeof fetch
  return { impl, calls }
}
const balancesBody = (tokenBalances: unknown[], pageKey?: string) => ({ jsonrpc: '2.0', id: 1, result: { address: ADDR, tokenBalances, ...(pageKey ? { pageKey } : {}) } })
const meta = (decimals: number | null, symbol: string, extra: Record<string, unknown> = {}) => ({ decimals, name: `${symbol} Token`, symbol, logo: `https://img.example/${symbol}.png`, ...extra })
const standard = (call: Call) => {
  const b = call.body as { method?: string } | Array<{ id: number; params: string[] }>
  if (Array.isArray(b)) return { body: b.map((item) => ({ jsonrpc: '2.0', id: item.id, result: item.params[0] === T1 ? meta(6, 'USDC') : meta(18, 'WETH') })) }
  return { body: balancesBody([{ contractAddress: T1, tokenBalance: '0x2625a0' }, { contractAddress: T2, tokenBalance: '0xde0b6b3a7640000' }], 'next_PAGE=') }
}

beforeEach(() => resetWalletTokensCache())

test('parseTokenBalances: drops zero, errored, malformed, duplicate; BigInt-exact; validates pageKey', () => {
  const parsed = parseTokenBalances(balancesBody([
    { contractAddress: T1, tokenBalance: '0x2625a0' },
    { contractAddress: T1.toUpperCase().replace('0X', '0x'), tokenBalance: '0x1' },
    { contractAddress: T2, tokenBalance: '0x0000000000000000000000000000000000000000000000000000000000000000' },
    { contractAddress: T3, tokenBalance: null, error: 'boom' },
    { contractAddress: 'nope', tokenBalance: '0x5' },
    { contractAddress: '0x' + 'd4'.repeat(20), tokenBalance: '0x' },
    { contractAddress: '0x' + 'e5'.repeat(20), tokenBalance: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' },
  ], 'bad key!'))
  assert.deepEqual(parsed.balances.map((b) => b.contract), [T1, '0x' + 'e5'.repeat(20)])
  assert.equal(parsed.balances[0].rawBalance, '2500000')
  assert.equal(parsed.balances[1].rawBalance, (2n ** 256n - 1n).toString())
  assert.equal(parsed.pageKey, null)
  assert.throws(() => parseTokenBalances({ result: {} }))
})

test('parseTokenMetadata: sanitises text, rejects non-https logos and implausible decimals', () => {
  const m = parseTokenMetadata({ name: '  Evil\u202eName\u0000  ', symbol: 'S'.repeat(80), decimals: 18, logo: 'https://x.example/l.png' })
  assert.equal(m.name, 'EvilName')
  assert.equal(m.symbol?.length, 24)
  assert.equal(m.logo, 'https://x.example/l.png')
  assert.equal(parseTokenMetadata({ decimals: 255, logo: 'http://x/l.png' }).decimals, null)
  assert.equal(parseTokenMetadata({ logo: 'http://x/l.png' }).logo, null)
  assert.equal(parseTokenMetadata({ logo: 'javascript:alert(1)' }).logo, null)
  assert.deepEqual(parseTokenMetadata(null), { name: null, symbol: null, decimals: null, logo: null })
})

test('happy path: ERC-20 balances + metadata, key only in the upstream URL, never in the response', async () => {
  const { impl, calls } = upstream(standard)
  const res = await handleWalletTokens(req(good), { apiKey: KEY, fetchImpl: impl })
  const text = await res.text()
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), 'private, no-store')
  assert.ok(!text.includes(KEY))
  const body = JSON.parse(text)
  assert.equal(body.address, ADDR.toLowerCase())
  assert.equal(body.nextPageKey, 'next_PAGE=')
  assert.equal(body.metadataPartial, false)
  assert.deepEqual(body.tokens.map((t: { symbol: string; rawBalance: string; decimals: number }) => [t.symbol, t.rawBalance, t.decimals]), [['USDC', '2500000', 6], ['WETH', '1000000000000000000', 18]])
  assert.equal(calls.length, 2)
  assert.ok(calls[0].url.startsWith('https://eth-mainnet.g.alchemy.com/v2/'))
  assert.deepEqual(calls[0].body, { jsonrpc: '2.0', id: 1, method: 'alchemy_getTokenBalances', params: [ADDR.toLowerCase(), 'erc20', { maxCount: 50 }] })
  assert.equal((calls[1].body as unknown[]).length, 2)
})

test('chain → provider slug mapping and pageKey forwarding', async () => {
  const { impl, calls } = upstream(() => ({ body: balancesBody([]) }))
  const slugs: Record<number, string> = { 10: 'opt-mainnet', 137: 'polygon-mainnet', 8453: 'base-mainnet', 42161: 'arb-mainnet', 59144: 'linea-mainnet', 11155111: 'eth-sepolia' }
  for (const [id, slug] of Object.entries(slugs)) {
    await handleWalletTokens(req(`chainId=${id}&address=${ADDR}`), { apiKey: KEY, fetchImpl: impl })
    assert.ok(calls[calls.length - 1].url.startsWith(`https://${slug}.g.alchemy.com/v2/`), id)
  }
  await handleWalletTokens(req(`${good}&pageKey=abc_123`), { apiKey: KEY, fetchImpl: impl })
  assert.deepEqual((calls[calls.length - 1].body as { params: unknown[] }).params[2], { maxCount: 50, pageKey: 'abc_123' })
})

test('empty holdings: no metadata call, empty list, no cursor', async () => {
  const { impl, calls } = upstream(() => ({ body: balancesBody([{ contractAddress: T1, tokenBalance: '0x0' }]) }))
  const body = await (await handleWalletTokens(req(good), { apiKey: KEY, fetchImpl: impl })).json()
  assert.deepEqual(body.tokens, [])
  assert.equal(body.nextPageKey, null)
  assert.equal(calls.length, 1)
})

test('metadata is cached per chain+contract; a second request only asks for unseen contracts', async () => {
  const first = upstream(standard)
  await handleWalletTokens(req(good), { apiKey: KEY, fetchImpl: first.impl })
  const second = upstream(standard)
  await handleWalletTokens(req(good), { apiKey: KEY, fetchImpl: second.impl })
  assert.equal(second.calls.length, 1) // balances only
  const otherChain = upstream(standard)
  await handleWalletTokens(req(`chainId=137&address=${ADDR}`), { apiKey: KEY, fetchImpl: otherChain.impl })
  assert.equal(otherChain.calls.length, 2) // cache is chain-specific
})

test('metadata failure keeps balances, marks metadata partial with null fields, and is not cached', async () => {
  let failMetadata = true
  const { impl, calls } = upstream((call) => Array.isArray(call.body) ? (failMetadata ? { status: 500, body: {} } : standard(call)) : standard(call))
  const body = await (await handleWalletTokens(req(good), { apiKey: KEY, fetchImpl: impl })).json()
  assert.equal(body.metadataPartial, true)
  assert.equal(body.tokens.length, 2)
  assert.deepEqual([body.tokens[0].symbol, body.tokens[0].decimals, body.tokens[0].logo], [null, null, null])
  assert.equal(body.tokens[0].rawBalance, '2500000')
  failMetadata = false
  const retry = await (await handleWalletTokens(req(good), { apiKey: KEY, fetchImpl: impl })).json()
  assert.equal(retry.metadataPartial, false)
  assert.equal(calls.length, 4)
})

test('per-token metadata errors are partial, not fatal', async () => {
  const { impl } = upstream((call) => Array.isArray(call.body)
    ? { body: [{ jsonrpc: '2.0', id: 0, result: meta(6, 'USDC') }, { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'x' } }] }
    : standard(call))
  const body = await (await handleWalletTokens(req(good), { apiKey: KEY, fetchImpl: impl })).json()
  assert.equal(body.metadataPartial, true)
  assert.equal(body.tokens[0].symbol, 'USDC')
  assert.equal(body.tokens[1].symbol, null)
})

test('input validation happens before any upstream call', async () => {
  const { impl, calls } = upstream(standard)
  for (const query of ['', `chainId=1`, `address=${ADDR}`, `chainId=56&address=${ADDR}`, `chainId=abc&address=${ADDR}`, 'chainId=1&address=0x123', `${good}&pageKey=bad key`, `chainId=1e0&address=${ADDR}`]) {
    const res = await handleWalletTokens(req(query), { apiKey: KEY, fetchImpl: impl })
    assert.equal(res.status, 400, query)
  }
  assert.equal((await handleWalletTokens(req(good, 'POST'), { apiKey: KEY, fetchImpl: impl })).status, 405)
  assert.equal(calls.length, 0)
})

test('missing key → 503 not-configured without calling upstream', async () => {
  const { impl, calls } = upstream(standard)
  const res = await handleWalletTokens(req(good), { fetchImpl: impl })
  assert.equal(res.status, 503)
  assert.equal((await res.json()).error.code, 'not-configured')
  assert.equal(calls.length, 0)
})

test('upstream failures map to explicit codes and never leak the key or URL', async () => {
  const cases: Array<[string, { status?: number; body?: unknown } | 'throw', number, string]> = [
    ['429', { status: 429, body: {} }, 429, 'rate-limited'],
    ['401', { status: 401, body: {} }, 502, 'provider-auth'],
    ['403', { status: 403, body: {} }, 502, 'provider-auth'],
    ['500', { status: 500, body: {} }, 502, 'upstream'],
    ['network', 'throw', 502, 'upstream'],
    ['rpc method missing', { body: { jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } } }, 422, 'chain-unsupported'],
    ['rpc compute units', { body: { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'Monthly capacity limit exceeded compute units' } } }, 429, 'rate-limited'],
    ['rpc generic', { body: { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'boom' } } }, 502, 'upstream'],
    ['garbage body', { body: { hello: 'world' } }, 502, 'upstream'],
  ]
  for (const [name, out, status, code] of cases) {
    const { impl } = upstream(() => out)
    const res = await handleWalletTokens(req(good), { apiKey: KEY, fetchImpl: impl })
    const text = await res.text()
    assert.equal(res.status, status, name)
    assert.equal(JSON.parse(text).error.code, code, name)
    assert.ok(!text.includes(KEY) && !text.includes('alchemy.com'), `${name}: leaked`)
  }
})
