import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchWalletTokens, formatTokenBalance, parseWalletTokensResponse, resolveTokenTarget } from './wallet-tokens.ts'

const A = '0xabcdef0123456789abcdef0123456789abcdef01'
const B = '0x1111111111111111111111111111111111111111'
const C1 = '0x' + 'c1'.repeat(20)
const envelope = (over: Record<string, unknown> = {}) => ({
  chainId: 1, address: A, tokens: [{ contract: C1, name: 'USD Coin', symbol: 'USDC', decimals: 6, rawBalance: '2500000', logo: 'https://img.example/usdc.png' }],
  nextPageKey: null, metadataPartial: false, provider: 'alchemy', ...over,
})
const reply = (body: unknown, status = 200, type = 'application/json') => (() => Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } }))) as unknown as typeof fetch

test('resolveTokenTarget: every wallet state', () => {
  assert.deepEqual(resolveTokenTarget(null, 1), { kind: 'no-wallet' })
  assert.deepEqual(resolveTokenTarget('0x12', 1), { kind: 'invalid-address' })
  assert.deepEqual(resolveTokenTarget(A, null), { kind: 'unknown-network' })
  assert.deepEqual(resolveTokenTarget(A, 56), { kind: 'unsupported-network', chainId: 56 })
  assert.deepEqual(resolveTokenTarget(A.toUpperCase().replace('0X', '0x'), 8453), { kind: 'ready', chainId: 8453, address: A })
  for (const id of [1, 10, 137, 8453, 42161, 59144, 11155111]) assert.equal(resolveTokenTarget(A, id).kind, 'ready', String(id))
})

test('account/network change produces a different target, so cached state keyed on it cannot be reused', () => {
  const first = resolveTokenTarget(A, 1)
  const otherAccount = resolveTokenTarget(B, 1)
  const otherChain = resolveTokenTarget(A, 137)
  assert.notDeepEqual(first, otherAccount)
  assert.notDeepEqual(first, otherChain)
})

test('formatTokenBalance: decimals, truncation, grouping, tiny and unknown', () => {
  assert.equal(formatTokenBalance('2500000', 6), '2.5')
  assert.equal(formatTokenBalance('1000000000000000000', 18), '1')
  assert.equal(formatTokenBalance('1234567890000000000000', 18), '1,234.56789')
  assert.equal(formatTokenBalance('1999999', 6), '1.999999')
  assert.equal(formatTokenBalance('123456789', 9), '0.123456') // truncated, not rounded to .123457
  assert.equal(formatTokenBalance('7', 0), '7')
  assert.equal(formatTokenBalance('1', 18), '<0.000001')
  assert.equal(formatTokenBalance('5', null), null)
  assert.equal(formatTokenBalance('not-a-number', 18), null)
})

test('parseWalletTokensResponse drops zero/duplicate/malformed tokens and unsafe logos, keeps unknown metadata as null', () => {
  const page = parseWalletTokensResponse(envelope({
    tokens: [
      { contract: C1, name: 'A', symbol: 'A', decimals: 18, rawBalance: '5', logo: 'http://insecure/x.png' },
      { contract: C1.toUpperCase().replace('0X', '0x'), name: 'dup', symbol: 'D', decimals: 18, rawBalance: '9', logo: null },
      { contract: B, name: null, symbol: null, decimals: 99, rawBalance: '10', logo: null },
      { contract: '0xbad', rawBalance: '1' },
      { contract: '0x' + '22'.repeat(20), rawBalance: '0' },
      { contract: '0x' + '33'.repeat(20), rawBalance: '-5' },
      null,
    ],
    nextPageKey: 'bad key with spaces',
  }))
  assert.deepEqual(page.tokens.map((t) => t.contract), [C1, B])
  assert.equal(page.tokens[0].logo, null)
  assert.equal(page.tokens[1].decimals, null)
  assert.equal(page.tokens[1].name, null)
  assert.equal(page.nextPageKey, null)
  assert.throws(() => parseWalletTokensResponse({ tokens: 'x' }))
})

test('fetchWalletTokens: success, empty list, and request shape', async () => {
  let seen = ''
  const impl = ((input: RequestInfo | URL) => { seen = String(input); return reply(envelope())() }) as typeof fetch
  const ok = await fetchWalletTokens(1, A.toUpperCase().replace('0X', '0x'), { fetchImpl: impl, pageKey: 'cursor_1' })
  assert.equal(ok.status, 'ok')
  assert.ok(seen.startsWith('/api/wallet-tokens?'))
  assert.ok(seen.includes(`address=${A}`) && seen.includes('chainId=1') && seen.includes('pageKey=cursor_1'))
  const empty = await fetchWalletTokens(1, A, { fetchImpl: reply(envelope({ tokens: [] })) })
  assert.equal(empty.status === 'ok' && empty.page.tokens.length, 0)
})

test('fetchWalletTokens rejects a response for another account or chain (no stale/foreign holdings)', async () => {
  const wrongAccount = await fetchWalletTokens(1, A, { fetchImpl: reply(envelope({ address: B })) })
  assert.equal(wrongAccount.status === 'error' && wrongAccount.kind, 'malformed')
  const wrongChain = await fetchWalletTokens(1, A, { fetchImpl: reply(envelope({ chainId: 137 })) })
  assert.equal(wrongChain.status === 'error' && wrongChain.kind, 'malformed')
})

test('fetchWalletTokens maps server errors, missing proxy, bad JSON, network failure and invalid input', async () => {
  const kind = async (impl: typeof fetch) => { const r = await fetchWalletTokens(1, A, { fetchImpl: impl }); return r.status === 'error' ? { kind: r.kind, retryable: r.retryable } : null }
  assert.deepEqual(await kind(reply({ error: { code: 'rate-limited' } }, 429)), { kind: 'rate-limited', retryable: true })
  assert.deepEqual(await kind(reply({ error: { code: 'not-configured' } }, 503)), { kind: 'not-configured', retryable: false })
  assert.deepEqual(await kind(reply({ error: { code: 'chain-unsupported' } }, 422)), { kind: 'chain-unsupported', retryable: false })
  assert.deepEqual(await kind(reply({ error: { code: 'weird' } }, 500)), { kind: 'upstream', retryable: true })
  assert.deepEqual(await kind(reply('<!doctype html>', 200, 'text/html')), { kind: 'proxy-missing', retryable: false })
  assert.deepEqual(await kind(reply('{oops', 200)), { kind: 'malformed', retryable: true })
  assert.deepEqual(await kind((() => Promise.reject(new TypeError('x'))) as unknown as typeof fetch), { kind: 'network', retryable: true })
  const invalid = await fetchWalletTokens(56, A, { fetchImpl: reply(envelope()) })
  assert.equal(invalid.status === 'error' && invalid.kind, 'invalid-request')
})

test('fetchWalletTokens honours abort and timeout', async () => {
  const hang = ((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('a', 'AbortError'))))) as typeof fetch
  const controller = new AbortController()
  const pending = fetchWalletTokens(1, A, { fetchImpl: hang, signal: controller.signal })
  controller.abort()
  const aborted = await pending
  assert.equal(aborted.status === 'error' && aborted.kind, 'aborted')
  const timeout = await fetchWalletTokens(1, A, { fetchImpl: hang, timeoutMs: 20 })
  assert.equal(timeout.status === 'error' && timeout.kind, 'timeout')
  const pre = new AbortController(); pre.abort()
  const already = await fetchWalletTokens(1, A, { fetchImpl: hang, signal: pre.signal })
  assert.equal(already.status === 'error' && already.kind, 'aborted')
})
