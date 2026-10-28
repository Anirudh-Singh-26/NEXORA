import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleSolanaActivity, parseSignatures, PAGE_SIZE } from '../../../api/solana-activity.ts'

const KEY = 'test-secret-key-123'
const ADDR = '11111111111111111111111111111112'
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const sig = (n: number) => `${'5'.repeat(84)}${ALPHA[Math.floor(n / ALPHA.length)]}${ALPHA[n % ALPHA.length]}${'z'.repeat(2)}`
const req = (query: string, method = 'GET') => new Request(`http://localhost/api/solana-activity?${query}`, { method })
const row = (n: number, over: Record<string, unknown> = {}) => ({ signature: sig(n), slot: 1000 - n, err: null, memo: null, blockTime: 1_700_000_000 + n, confirmationStatus: 'finalized', ...over })

function upstream(handler: (params: unknown[]) => { status?: number; body?: unknown } | 'throw') {
  const calls: Array<{ url: string; params: unknown[] }> = []
  const impl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const parsed = JSON.parse(String(init?.body)) as { method: string; params: unknown[] }
        calls.push({ url: String(input), params: parsed.params })
    const out = handler(parsed.params)
    if (out === 'throw') return Promise.reject(new TypeError(`fetch failed for ${String(input)}`))
    return Promise.resolve(new Response(JSON.stringify(out.body ?? {}), { status: out.status ?? 200 }))
  }) as typeof fetch
  return { impl, calls }
}

test('parseSignatures: status from err, missing blockTime/err handled, malformed rows dropped, duplicates removed', () => {
  const items = parseSignatures([row(1), row(2, { err: { InstructionError: [0, 'x'] } }), row(3, { blockTime: null }), row(4, { err: undefined }), row(1), { signature: 'short', slot: 1 }, row(5, { slot: -1 }), null])
  assert.deepEqual(items.map((i) => i.status), ['success', 'failed', 'success', null])
  assert.equal(items[2].blockTime, null)
  assert.throws(() => parseSignatures('no'))
})

test('handler: validates request before any upstream call', async () => {
  const { impl, calls } = upstream(() => ({ body: { result: [] } }))
  assert.equal((await handleSolanaActivity(req(`address=${ADDR}`, 'POST'), { apiKey: KEY, fetchImpl: impl })).status, 405)
  for (const query of ['', 'address=0x' + 'a'.repeat(40), `address=${ADDR}&address=${ADDR}`, `address=${ADDR}&cursor=bad`, `address=${ADDR}&cursor=${sig(1)}&cursor=${sig(2)}`]) {
    assert.equal((await handleSolanaActivity(req(query), { apiKey: KEY, fetchImpl: impl })).status, 400, query)
  }
  assert.equal(calls.length, 0)
})

test('handler: full page returns a cursor, short page ends history, cursor is sent as `before`', async () => {
  const full = upstream(() => ({ body: { result: Array.from({ length: PAGE_SIZE }, (_, i) => row(i + 1)) } }))
  const first = await (await handleSolanaActivity(req(`address=${ADDR}`), { apiKey: KEY, fetchImpl: full.impl })).json() as { items: unknown[]; nextCursor: string | null }
  assert.equal(first.items.length, PAGE_SIZE)
  assert.equal(first.nextCursor, sig(PAGE_SIZE))
  assert.ok(full.calls[0].url.startsWith('https://solana-devnet.g.alchemy.com/v2/'))

  const short = upstream(() => ({ body: { result: [row(1)] } }))
  const second = await (await handleSolanaActivity(req(`address=${ADDR}&cursor=${sig(PAGE_SIZE)}`), { apiKey: KEY, fetchImpl: short.impl })).json() as { nextCursor: string | null }
  assert.equal(second.nextCursor, null)
  assert.equal((short.calls[0].params[1] as { before: string }).before, sig(PAGE_SIZE))

  const empty = upstream(() => ({ body: { result: [] } }))
  const none = await (await handleSolanaActivity(req(`address=${ADDR}`), { apiKey: KEY, fetchImpl: empty.impl })).json() as { items: unknown[] }
  assert.deepEqual(none.items, [])
})

test('handler: provider failures map to safe errors', async () => {
  const cases: Array<[ReturnType<typeof upstream>, number, string]> = [
    [upstream(() => 'throw'), 502, 'upstream'],
    [upstream(() => ({ status: 429 })), 429, 'rate-limited'],
    [upstream(() => ({ status: 403 })), 502, 'provider-auth'],
    [upstream(() => ({ body: { error: { code: -32005, message: 'Too many requests' } } })), 429, 'rate-limited'],
    [upstream(() => ({ body: { result: {} } })), 502, 'upstream'],
  ]
  for (const [{ impl }, status, code] of cases) {
    const response = await handleSolanaActivity(req(`address=${ADDR}`), { apiKey: KEY, fetchImpl: impl })
    const text = await response.text()
    assert.equal(response.status, status, code)
    assert.equal((JSON.parse(text) as { error: { code: string } }).error.code, code)
    assert.ok(!text.includes(KEY) && !text.includes('alchemy.com'))
  }
})
