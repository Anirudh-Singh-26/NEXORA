import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { GET as balanceGET, handleSolanaBalance } from '../../../api/solana-balance.ts'
import { GET as activityGET, handleSolanaActivity } from '../../../api/solana-activity.ts'

const KEY = 'test-secret-key-123'
const ADDR = 'So11111111111111111111111111111111111111112'
const SIG = '5'.repeat(88)
const balanceReq = () => new Request(`http://localhost/api/solana-balance?address=${ADDR}`)
const activityReq = () => new Request(`http://localhost/api/solana-activity?address=${ADDR}`)

type Reply = { status?: number; text?: string } | 'throw'
function upstream(respond: (url: string, method: string) => Reply) {
  const calls: Array<{ url: string; method: string }> = []
  const impl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const { method } = JSON.parse(String(init?.body)) as { method: string }
    calls.push({ url, method })
    const out = respond(url, method)
    if (out === 'throw') return Promise.reject(new TypeError(`fetch failed ${url}`))
    return Promise.resolve(new Response(out.text ?? '{}', { status: out.status ?? 200 }))
  }) as typeof fetch
  return { impl, calls }
}
const bal = (n: number) => ({ text: `{"jsonrpc":"2.0","id":1,"result":{"context":{"slot":1},"value":${n}}}` })
const sigs = { text: JSON.stringify({ jsonrpc: '2.0', id: 1, result: [{ signature: SIG, slot: 5, err: null, blockTime: 1_700_000_000, confirmationStatus: 'finalized' }] }) }
const txNull = { text: '{"jsonrpc":"2.0","id":1,"result":null}' }
const isAlchemy = (url: string) => url.includes('alchemy.com')

const ALCHEMY_FAILURES: Array<[string, Reply]> = [
  ['HTTP 400 (network not enabled)', { status: 400, text: 'RAW' }],
  ['HTTP 404', { status: 404, text: 'RAW' }],
  ['HTTP 500', { status: 500, text: 'RAW' }],
  ['HTTP 429', { status: 429, text: 'RAW' }],
  ['network error / timeout', 'throw'],
  ['non-JSON body', { status: 200, text: '<html>RAW</html>' }],
  ['empty body', { status: 200, text: '' }],
  ['JSON-RPC error', { status: 200, text: '{"error":{"code":-32600,"message":"RAW"}}' }],
]

for (const [name, failure] of ALCHEMY_FAILURES) {
  test(`balance: Alchemy ${name} falls back to the public Devnet RPC`, async () => {
    const up = upstream((url) => (isAlchemy(url) ? failure : bal(42)))
    const response = await handleSolanaBalance(balanceReq(), { apiKey: KEY, fetchImpl: up.impl })
    const text = await response.text()
    assert.equal(response.status, 200, text)
    assert.deepEqual(JSON.parse(text), { address: ADDR, lamports: '42', provider: 'solana-devnet-public' })
    assert.ok(up.calls.every((c) => !/mainnet/i.test(c.url)))
    assert.ok(!text.includes(KEY) && !text.includes('RAW'))
  })

  test(`activity: Alchemy ${name} falls back to the public Devnet RPC`, async () => {
    const up = upstream((url, method) => (isAlchemy(url) ? failure : method === 'getSignaturesForAddress' ? sigs : txNull))
    const response = await handleSolanaActivity(activityReq(), { apiKey: KEY, fetchImpl: up.impl })
    const text = await response.text()
    assert.equal(response.status, 200, text)
    const body = JSON.parse(text) as { cluster: string; provider: string; items: Array<{ signature: string; details: unknown }> }
    assert.equal(body.cluster, 'devnet')
    assert.equal(body.provider, 'solana-devnet-public')
    assert.equal(body.items[0].signature, SIG)
    assert.ok(up.calls.every((c) => !/mainnet/i.test(c.url)))
    assert.ok(!text.includes(KEY) && !text.includes('RAW'))
  })
}

test('both providers fail: sanitized 4xx/5xx JSON for both endpoints, never a key, URL or provider text', async () => {
  for (const failure of [{ status: 500, text: 'RAW' }, { status: 200, text: 'RAW not json' }, 'throw'] as Reply[]) {
    const up = upstream(() => failure)
    for (const response of [await handleSolanaBalance(balanceReq(), { apiKey: KEY, fetchImpl: up.impl }), await handleSolanaActivity(activityReq(), { apiKey: KEY, fetchImpl: up.impl })]) {
      const text = await response.text()
      assert.equal(response.status, 502)
      assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8')
      assert.equal((JSON.parse(text) as { error: { code: string } }).error.code, 'upstream')
      assert.ok(!text.includes(KEY) && !text.includes('RAW') && !text.includes('alchemy') && !text.includes('fetch failed') && !/\bat \w+/.test(text), text)
    }
  }
})

test('malformed successful responses are rejected, not rendered as data', async () => {
  const bad = [
    { text: '{"result":{"value":"12"}}' }, { text: '{"result":{"value":-5}}' }, { text: '{"result":null}' }, { text: '[]' },
  ]
  for (const reply of bad) {
    const response = await handleSolanaBalance(balanceReq(), { fetchImpl: upstream(() => reply).impl })
    assert.equal(response.status, 502, reply.text)
  }
  for (const text of ['{"result":{"not":"an array"}}', '{"result":"nope"}', '{"result":null}', '{}']) {
    const response = await handleSolanaActivity(activityReq(), { fetchImpl: upstream(() => ({ text })).impl })
    assert.equal(response.status, 502, text)
  }
})

test('Devnet only: with and without a key, every request goes to a Devnet host', async () => {
  for (const apiKey of [KEY, undefined]) {
    const up = upstream((_url, method) => (method === 'getBalance' ? bal(1) : method === 'getSignaturesForAddress' ? sigs : txNull))
    await handleSolanaBalance(balanceReq(), { apiKey, fetchImpl: up.impl })
    await handleSolanaActivity(activityReq(), { apiKey, fetchImpl: up.impl })
    assert.ok(up.calls.length >= 2)
    for (const call of up.calls) assert.ok(call.url === 'https://api.devnet.solana.com' || call.url === `https://solana-devnet.g.alchemy.com/v2/${KEY}`, call.url)
  }
})

test('GET entries never throw: an unexpected exception becomes a sanitized JSON 502', async () => {
  const savedFetch = globalThis.fetch
  const savedKey = process.env.ALCHEMY_API_KEY
  const savedError = console.error
  const logged: unknown[][] = []
  console.error = (...args: unknown[]) => { logged.push(args) }
  process.env.ALCHEMY_API_KEY = KEY
  try {
    // A Request whose URL getter throws escapes the handler's own checks.
    const exploding = { method: 'GET', get url(): string { throw new Error(`boom ${KEY}`) } } as unknown as Request
    for (const entry of [balanceGET, activityGET]) {
      const response = await entry(exploding)
      const text = await response.text()
      assert.equal(response.status, 502)
      assert.ok(!text.includes(KEY) && !text.includes('boom'))
    }
    assert.ok(logged.length >= 2)
    assert.ok(!JSON.stringify(logged).includes(KEY))
  } finally {
    console.error = savedError
    globalThis.fetch = savedFetch
    if (savedKey === undefined) delete process.env.ALCHEMY_API_KEY
    else process.env.ALCHEMY_API_KEY = savedKey
  }
})

test('deployment: Vercel compiles api/*.ts with the root tsconfig but does not rewrite `.ts` import specifiers unless told to', () => {
  // Root cause of the production HTTP 500 (FUNCTION_INVOCATION_FAILED): the deployed bundle contains only compiled .js files,
  // while the compiled code still said `import … from '../src/lib/….ts'` => ERR_MODULE_NOT_FOUND on every invocation.
  const tsconfig = readFileSync(new URL('../../../tsconfig.json', import.meta.url), 'utf8')
  assert.match(tsconfig, /"rewriteRelativeImportExtensions"\s*:\s*true/)
})
