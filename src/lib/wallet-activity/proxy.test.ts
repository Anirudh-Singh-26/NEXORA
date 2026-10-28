import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleWalletActivity, mergeStreams, parseTransfers, PAGE_SIZE, type RawTransfer } from '../../../api/wallet-activity.ts'

const KEY = 'test-secret-key-123'
const ME = '0xabcdef0123456789abcdef0123456789abcdef01'
const OTHER = '0x1111111111111111111111111111111111111111'
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const hash = (n: number) => '0x' + n.toString(16).padStart(64, '0')
const req = (query: string, method = 'GET') => new Request(`http://localhost/api/wallet-activity?${query}`, { method })
const good = `chainId=1&address=${ME}`

const external = (n: number, block: number, over: Record<string, unknown> = {}) => ({
  blockNum: '0x' + block.toString(16), uniqueId: `${hash(n)}:external`, hash: hash(n), from: ME, to: OTHER, value: 1.5, asset: 'ETH', category: 'external',
  rawContract: { value: '0x14d1120d7b160000', address: null, decimal: '0x12' }, metadata: { blockTimestamp: '2025-01-02T03:04:05.000Z' }, ...over,
})
const erc20 = (n: number, block: number, over: Record<string, unknown> = {}) => ({
  blockNum: '0x' + block.toString(16), uniqueId: `${hash(n)}:log:1`, hash: hash(n), from: OTHER, to: ME, value: 12.5, asset: 'USDC', category: 'erc20',
  rawContract: { value: '0xbebc20', address: USDC, decimal: '0x6' }, metadata: { blockTimestamp: '2025-01-02T03:04:05.000Z' }, ...over,
})
const nft = (n: number, block: number) => ({
  blockNum: '0x' + block.toString(16), uniqueId: `${hash(n)}:log:2`, hash: hash(n), from: OTHER, to: ME, value: null, asset: null, category: 'erc721', erc721TokenId: '0x2a',
  rawContract: { value: null, address: USDC, decimal: null }, metadata: { blockTimestamp: '2025-01-02T03:04:05.000Z' },
})
const body = (transfers: unknown[], pageKey?: string) => ({ jsonrpc: '2.0', id: 1, result: { transfers, ...(pageKey ? { pageKey } : {}) } })

interface Call { url: string; params: Record<string, unknown> }
function upstream(handler: (call: Call) => { status?: number; body?: unknown } | 'throw') {
  const calls: Call[] = []
  const impl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const parsed = JSON.parse(String(init?.body)) as { params: Array<Record<string, unknown>> }
    const call = { url: String(input), params: parsed.params[0] }
    calls.push(call)
    const out = handler(call)
    if (out === 'throw') return Promise.reject(new TypeError(`fetch failed for ${call.url}`))
    return Promise.resolve(new Response(JSON.stringify(out.body ?? {}), { status: out.status ?? 200 }))
  }) as typeof fetch
  return { impl, calls }
}

test('parseTransfers: exact amounts, NFT token ids, drops malformed rows, tolerates missing timestamp/amount', () => {
  const { transfers, hasMore } = parseTransfers(body([
    external(1, 100), erc20(2, 99), nft(3, 98),
    { ...external(4, 97), hash: 'nope' },
    { ...external(5, 96), blockNum: 'zz' },
    { ...external(6, 95), category: 'internal' },
    { ...external(7, 94), from: null, to: null },
    null,
    external(8, 93, { metadata: {}, value: null, rawContract: {} }),
  ], 'k'))
  assert.equal(hasMore, true)
  assert.deepEqual(transfers.map((t) => t.hash), [hash(1), hash(2), hash(3), hash(8)])
  assert.equal(transfers[0].amount, '1.5')
  assert.equal(transfers[1].amount, '12.5')
  assert.equal(transfers[1].contract, USDC)
  assert.equal(transfers[2].tokenId, '42')
  assert.equal(transfers[2].amount, null)
  assert.equal(transfers[3].timestamp, null)
  assert.equal(transfers[3].amount, null)
})

test('parseTransfers: erc1155 yields one transfer per token id; malformed envelope throws', () => {
  const row = { ...nft(1, 10), category: 'erc1155', erc721TokenId: null, erc1155Metadata: [{ tokenId: '0x1', value: '0x3' }, { tokenId: 'bad', value: '0x1' }, { tokenId: '0x2', value: '0x1' }] }
  const { transfers } = parseTransfers(body([row]))
  assert.deepEqual(transfers.map((t) => [t.tokenId, t.amount]), [['1', '3'], ['2', '1']])
  assert.throws(() => parseTransfers({ result: {} }))
  assert.throws(() => parseTransfers(null))
})

test('mergeStreams: groups events by hash, dedupes a self-transfer, puts native first', () => {
  const sent = parseTransfers(body([external(1, 100), erc20(1, 100, { uniqueId: 'x' })]))
  const received = parseTransfers(body([external(1, 100), nft(2, 90)]))
  const { items, nextBlock } = mergeStreams([sent, received])
  assert.equal(nextBlock, null)
  assert.equal(items.length, 2)
  assert.equal(items[0].hash, hash(1))
  assert.deepEqual(items[0].transfers.map((t) => t.category), ['external', 'erc20'])
})

test('mergeStreams: only emits blocks both streams cover and returns the cutoff cursor', () => {
  const t = (n: number, block: number): RawTransfer => parseTransfers(body([external(n, block)])).transfers[0]
  // sent stream has more rows below block 80; received stream is exhausted with rows down to 10
  const { items, nextBlock } = mergeStreams([
    { transfers: [t(1, 100), t(2, 80)], hasMore: true },
    { transfers: [t(3, 90), t(4, 10)], hasMore: false },
  ])
  assert.deepEqual(items.map((i) => i.blockNumber), [100, 90])
  assert.equal(nextBlock, 80)
})

test('mergeStreams: a page made of one block steps below it instead of looping', () => {
  const same = Array.from({ length: 3 }, (_, i) => parseTransfers(body([external(i + 1, 50)])).transfers[0])
  const { items, nextBlock } = mergeStreams([{ transfers: same, hasMore: true }, { transfers: [], hasMore: false }])
  assert.equal(items.length, 3)
  assert.equal(nextBlock, 49)
})

test('handler: validates method, key, chain, address and cursor before any upstream call', async () => {
  const { impl, calls } = upstream(() => ({ body: body([]) }))
  assert.equal((await handleWalletActivity(req(good, 'POST'), { apiKey: KEY, fetchImpl: impl })).status, 405)
  assert.equal((await handleWalletActivity(req(good), { fetchImpl: impl })).status, 503)
  for (const query of [`chainId=59144&address=${ME}`, `chainId=1&address=0x123`, `address=${ME}`, `chainId=1`, `chainId=1.5&address=${ME}`, `${good}&cursor=abc`, `${good}&cursor=-1`, `${good}&cursor=${'9'.repeat(13)}`]) {
    assert.equal((await handleWalletActivity(req(query), { apiKey: KEY, fetchImpl: impl })).status, 400, query)
  }
  assert.equal(calls.length, 0)
})

test('handler: queries sent and received on the fixed chain endpoint and returns grouped, lowercase results', async () => {
  const { impl, calls } = upstream((call) => ({ body: body(call.params.fromAddress ? [external(1, 100)] : [erc20(1, 100)]) }))
  const response = await handleWalletActivity(req(`chainId=8453&address=${ME.toUpperCase().replace('0X', '0x')}`), { apiKey: KEY, fetchImpl: impl })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const data = await response.json() as { chainId: number; address: string; items: Array<{ hash: string; transfers: unknown[] }>; nextCursor: string | null }
  assert.equal(data.chainId, 8453)
  assert.equal(data.address, ME)
  assert.equal(data.items.length, 1)
  assert.equal(data.items[0].transfers.length, 2)
  assert.equal(data.nextCursor, null)
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.ok(call.url.startsWith('https://base-mainnet.g.alchemy.com/v2/'))
    assert.equal(call.params.toBlock, 'latest')
    assert.equal(call.params.maxCount, `0x${PAGE_SIZE.toString(16)}`)
    assert.equal(call.params.order, 'desc')
  }
  assert.deepEqual(calls.map((c) => Boolean(c.params.fromAddress)).sort(), [false, true])
})

test('handler: cursor becomes toBlock and a partial page yields a cursor', async () => {
  const { impl, calls } = upstream((call) => ({ body: call.params.fromAddress ? body([external(1, 200), external(2, 150)], 'more') : body([erc20(3, 190)]) }))
  const response = await handleWalletActivity(req(`${good}&cursor=300`), { apiKey: KEY, fetchImpl: impl })
  const data = await response.json() as { items: Array<{ hash: string }>; nextCursor: string | null }
  assert.equal(calls[0].params.toBlock, '0x12c')
  assert.deepEqual(data.items.map((i) => i.hash), [hash(1), hash(3)])
  assert.equal(data.nextCursor, '150')
})

test('handler: provider failures map to safe errors and never leak the key or URL', async () => {
  const cases: Array<[ReturnType<typeof upstream>, number, string]> = [
    [upstream(() => 'throw'), 502, 'upstream'],
    [upstream(() => ({ status: 429, body: {} })), 429, 'rate-limited'],
    [upstream(() => ({ status: 401, body: {} })), 502, 'provider-auth'],
    [upstream(() => ({ status: 500, body: {} })), 502, 'upstream'],
    [upstream(() => ({ body: { error: { code: -32601, message: 'Method not supported' } } })), 422, 'chain-unsupported'],
    [upstream(() => ({ body: { error: { code: 429, message: 'exceeded compute units' } } })), 429, 'rate-limited'],
    [upstream(() => ({ body: { result: 'garbage' } })), 502, 'upstream'],
  ]
  for (const [{ impl }, status, code] of cases) {
    const response = await handleWalletActivity(req(good), { apiKey: KEY, fetchImpl: impl })
    const text = await response.text()
    assert.equal(response.status, status, code)
    assert.equal((JSON.parse(text) as { error: { code: string } }).error.code, code)
    assert.ok(!text.includes(KEY) && !text.includes('alchemy.com'))
  }
})
