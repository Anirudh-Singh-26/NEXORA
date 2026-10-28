import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchSolanaBalance, isSolanaAddress, lamportsToSol, parseSolanaBalanceResponse, resolveSolanaTarget } from './solana-balance.ts'

const ADDR = '11111111111111111111111111111111' // System Program: 32 bytes of zero
const ADDR2 = 'So11111111111111111111111111111111111111112' // wrapped-SOL mint address (valid 32-byte key)
const jsonResponse = (body: unknown, status = 200, type = 'application/json') => new Response(JSON.stringify(body), { status, headers: { 'content-type': type } })
const okBody = (address: string, lamports: string) => ({ address, lamports, provider: 'alchemy' })

test('isSolanaAddress: accepts real 32-byte keys, rejects malformed input', () => {
  assert.equal(isSolanaAddress(ADDR), true)
  assert.equal(isSolanaAddress(ADDR2), true)
  for (const bad of [undefined, null, 5, '', 'short', '0x' + 'a'.repeat(40), ADDR + '1', ADDR.slice(0, -1), 'O' + ADDR2.slice(1), ' ' + ADDR, `${ADDR}\n`]) {
    assert.equal(isSolanaAddress(bad), false, `should reject ${JSON.stringify(bad)}`)
  }
})

test('lamportsToSol: exact BigInt conversion, truncation-free to 9 decimals, no float error', () => {
  assert.equal(lamportsToSol('0'), '0')
  assert.equal(lamportsToSol('1'), '0.000000001')
  assert.equal(lamportsToSol('1000000000'), '1')
  assert.equal(lamportsToSol('1500000000'), '1.5')
  assert.equal(lamportsToSol('123456789'), '0.123456789')
  assert.equal(lamportsToSol('1000000001'), '1.000000001') // would round to 1 as a float with fewer digits
  assert.equal(lamportsToSol('9007199254740993'), '9007199.254740993') // > 2^53: exact
  assert.equal(lamportsToSol('18446744073709551615'), '18446744073.709551615')
})

test('parseSolanaBalanceResponse: validates the envelope and formats the amount', () => {
  const parsed = parseSolanaBalanceResponse(okBody(ADDR, '1234567890000'))
  assert.equal(parsed.sol, '1234.56789')
  assert.equal(parsed.display, '1,234.56789')
  for (const bad of [null, {}, okBody('nope', '1'), okBody(ADDR, '-1'), okBody(ADDR, '1.5'), okBody(ADDR, '01'), okBody(ADDR, '1'.repeat(21)), { address: ADDR, lamports: 5 }]) {
    assert.throws(() => parseSolanaBalanceResponse(bad), `should reject ${JSON.stringify(bad)}`)
  }
})

test('resolveSolanaTarget: every wallet state — address only (backward-compat, no networkName)', () => {
  assert.deepEqual(resolveSolanaTarget(null), { kind: 'no-wallet' })
  assert.deepEqual(resolveSolanaTarget('0x' + 'a'.repeat(40)), { kind: 'invalid-address' })
  // No networkName arg → backward-compat: defaults to Devnet name
  assert.deepEqual(resolveSolanaTarget(ADDR2), { kind: 'ready', address: ADDR2, networkName: 'Solana Devnet' })
})

test('resolveSolanaTarget: network-aware resolution — Devnet variants → ready', () => {
  // AppKit Devnet network name
  assert.equal(resolveSolanaTarget(ADDR2, 'Solana Devnet')?.kind, 'ready')
  assert.equal(resolveSolanaTarget(ADDR2, 'solana-devnet')?.kind, 'ready')
  assert.equal(resolveSolanaTarget(ADDR2, 'devnet')?.kind, 'ready')
  assert.equal(resolveSolanaTarget(ADDR2, 'Devnet')?.kind, 'ready')
  // networkName propagated into ready target
  const t = resolveSolanaTarget(ADDR2, 'Solana Devnet')
  if (t.kind === 'ready') assert.equal(t.networkName, 'Solana Devnet')
})

test('resolveSolanaTarget: network-aware resolution — Mainnet/unrecognised → unsupported-network', () => {
  // AppKit mainnet network name ("Solana")
  const sol = resolveSolanaTarget(ADDR2, 'Solana')
  assert.equal(sol.kind, 'unsupported-network')
  if (sol.kind === 'unsupported-network') {
    assert.equal(sol.networkName, 'Solana')
    assert.match(sol.reason, /devnet/i)
  }
  // Other mainnet forms
  assert.equal(resolveSolanaTarget(ADDR2, 'mainnet')?.kind, 'unsupported-network')
  assert.equal(resolveSolanaTarget(ADDR2, 'mainnet-beta')?.kind, 'unsupported-network')
  assert.equal(resolveSolanaTarget(ADDR2, 'solana-mainnet')?.kind, 'unsupported-network')
  // Completely unrecognised network
  assert.equal(resolveSolanaTarget(ADDR2, 'my-custom-net')?.kind, 'unsupported-network')
})

test('resolveSolanaTarget: null networkName → unknown-network', () => {
  const t = resolveSolanaTarget(ADDR2, null)
  assert.equal(t.kind, 'unknown-network')
  // invalid-address still takes priority over network check
  assert.equal(resolveSolanaTarget('0x1234', null).kind, 'invalid-address')
  // null address still gives no-wallet
  assert.equal(resolveSolanaTarget(null, null).kind, 'no-wallet')
})

test('fetchSolanaBalance: success, and the request carries only the address', async () => {
  let requested = ''
  const result = await fetchSolanaBalance(ADDR2, { fetchImpl: ((url: string) => { requested = url; return Promise.resolve(jsonResponse(okBody(ADDR2, '2500000000'))) }) as unknown as typeof fetch })
  assert.equal(result.status, 'ok')
  if (result.status === 'ok') assert.equal(result.balance.display, '2.5')
  assert.equal(requested, `/api/solana-balance?address=${ADDR2}`)
})

test('fetchSolanaBalance: invalid address is rejected without any network call', async () => {
  let called = false
  const result = await fetchSolanaBalance('0x1234', { fetchImpl: (() => { called = true; return Promise.resolve(jsonResponse({})) }) as unknown as typeof fetch })
  assert.deepEqual(result.status === 'error' && result.kind, 'invalid-request')
  assert.equal(called, false)
})

test('fetchSolanaBalance: a balance for a different address is never accepted (no stale/mismatched data)', async () => {
  const result = await fetchSolanaBalance(ADDR2, { fetchImpl: (() => Promise.resolve(jsonResponse(okBody(ADDR, '5')))) as unknown as typeof fetch })
  assert.equal(result.status === 'error' && result.kind, 'malformed')
})

test('fetchSolanaBalance: malformed, HTML (missing proxy), provider errors and rate limiting map to fixed messages', async () => {
  const run = (response: () => Response | Promise<Response>) => fetchSolanaBalance(ADDR2, { fetchImpl: (() => Promise.resolve(response())) as unknown as typeof fetch })
  const kind = (r: Awaited<ReturnType<typeof run>>) => (r.status === 'error' ? r.kind : 'ok')
  assert.equal(kind(await run(() => jsonResponse({ nonsense: true }))), 'malformed')
  assert.equal(kind(await run(() => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }))), 'proxy-missing')
  assert.equal(kind(await run(() => new Response('not json', { status: 200, headers: { 'content-type': 'application/json' } }))), 'malformed')
  assert.equal(kind(await run(() => jsonResponse({ error: { code: 'rate-limited', message: 'x' } }, 429))), 'rate-limited')
  assert.equal(kind(await run(() => jsonResponse({ error: { code: 'not-configured', message: 'x' } }, 503))), 'not-configured')
  assert.equal(kind(await run(() => jsonResponse({ error: { code: 'provider-auth', message: 'x' } }, 502))), 'provider-auth')
  assert.equal(kind(await run(() => jsonResponse({ error: { code: 'weird', message: 'raw provider text' } }, 502))), 'upstream')
  const limited = await run(() => jsonResponse({ error: { code: 'rate-limited', message: 'RAW PROVIDER TEXT' } }, 429))
  assert.ok(limited.status === 'error' && limited.retryable && !limited.message.includes('RAW'))
  const failing = await fetchSolanaBalance(ADDR2, { fetchImpl: (() => Promise.reject(new TypeError('boom https://secret'))) as unknown as typeof fetch })
  assert.ok(failing.status === 'error' && failing.kind === 'network' && !failing.message.includes('secret'))
})

test('fetchSolanaBalance: an aborted request (account change/disconnect) returns "aborted", never data', async () => {
  const before = new AbortController(); before.abort()
  let called = false
  const preAborted = await fetchSolanaBalance(ADDR2, { signal: before.signal, fetchImpl: (() => { called = true; return Promise.resolve(jsonResponse(okBody(ADDR2, '1'))) }) as unknown as typeof fetch })
  assert.equal(preAborted.status === 'error' && preAborted.kind, 'aborted')
  assert.equal(called, false)

  const controller = new AbortController()
  const hanging = ((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })) as unknown as typeof fetch
  const pending = fetchSolanaBalance(ADDR2, { signal: controller.signal, fetchImpl: hanging })
  controller.abort()
  const midFlight = await pending
  assert.equal(midFlight.status === 'error' && midFlight.kind, 'aborted')
})

test('fetchSolanaBalance: a slow proxy times out', async () => {
  const hanging = ((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })) as unknown as typeof fetch
  const result = await fetchSolanaBalance(ADDR2, { fetchImpl: hanging, timeoutMs: 20 })
  assert.equal(result.status === 'error' && result.kind, 'timeout')
})
