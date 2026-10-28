import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fetchShastaBalance, ShastaBalanceError, SHASTA_GETACCOUNT_URL } from './balance.ts'
import { formatSunAsTrx, looksLikeTronAddress, parseSun, shortenTronAddress, SUN_PER_TRX } from './format.ts'
import { classifyTronNetwork, MAINNET_CHAIN_ID, NILE_CHAIN_ID, SHASTA_CHAIN_ID } from './network.ts'

const ADDRESS = 'TLsV52sRDL79HXGGm9yzwKibb6BeruhUzy'

function jsonResponse(text: string, status = 200): Response {
  return new Response(text, { status, headers: { 'content-type': 'application/json' } })
}

describe('classifyTronNetwork', () => {
  it('identifies Shasta only when chain ID and label agree', () => {
    const net = classifyTronNetwork({ chainId: SHASTA_CHAIN_ID, networkType: 'Shasta' })
    assert.equal(net.kind, 'shasta')
    assert.equal(net.verifiedShasta, true)
  })
  it('accepts Shasta by chain ID when no label is given, case-insensitively', () => {
    assert.equal(classifyTronNetwork({ chainId: '0x94A9059E' }).verifiedShasta, true)
  })
  it('never reports Shasta from a label alone', () => {
    const net = classifyTronNetwork({ chainId: '0xdeadbeef', networkType: 'Shasta' })
    assert.equal(net.kind, 'unknown')
    assert.equal(net.verifiedShasta, false)
    assert.equal(net.inconsistent, true)
    assert.equal(classifyTronNetwork({ chainId: null, networkType: 'Shasta' }).verifiedShasta, false)
  })
  it('rejects a Shasta chain ID contradicted by the label', () => {
    const net = classifyTronNetwork({ chainId: SHASTA_CHAIN_ID, networkType: 'Mainnet' })
    assert.equal(net.kind, 'unknown')
    assert.equal(net.verifiedShasta, false)
    assert.equal(net.inconsistent, true)
  })
  it('labels Mainnet and Nile as such and never as verified Shasta', () => {
    assert.equal(classifyTronNetwork({ chainId: MAINNET_CHAIN_ID, networkType: 'Mainnet' }).kind, 'mainnet')
    assert.equal(classifyTronNetwork({ chainId: NILE_CHAIN_ID, networkType: 'Nile' }).kind, 'nile')
    assert.equal(classifyTronNetwork({ chainId: MAINNET_CHAIN_ID }).verifiedShasta, false)
    assert.equal(classifyTronNetwork({ chainId: NILE_CHAIN_ID }).verifiedShasta, false)
  })
  it('treats missing or empty input as unknown', () => {
    assert.equal(classifyTronNetwork({}).kind, 'unknown')
    assert.equal(classifyTronNetwork({ chainId: '  ' }).verifiedShasta, false)
  })
})

describe('SUN / TRX formatting', () => {
  it('uses 1 TRX = 1,000,000 SUN', () => {
    assert.equal(SUN_PER_TRX, 1_000_000n)
    assert.equal(formatSunAsTrx(1_000_000n), '1')
    assert.equal(formatSunAsTrx(1n), '0.000001')
    assert.equal(formatSunAsTrx(85_623_170n), '85.62317')
    assert.equal(formatSunAsTrx(0n), '0')
  })
  it('groups thousands and supports a minimum fraction', () => {
    assert.equal(formatSunAsTrx(1_234_567_890_000n), '1,234,567.89')
    assert.equal(formatSunAsTrx(5_000_000n, 2), '5.00')
    assert.equal(formatSunAsTrx(5_500_000n, 2), '5.50')
  })
  it('is exact for amounts beyond 2^53 SUN', () => {
    assert.equal(formatSunAsTrx(9_007_199_254_740_993n), '9,007,199,254.740993')
  })
  it('rejects negative amounts', () => {
    assert.throws(() => formatSunAsTrx(-1n), RangeError)
  })
  it('parses SUN only from whole non-negative numbers', () => {
    assert.equal(parseSun(10), 10n)
    assert.equal(parseSun('10'), 10n)
    assert.equal(parseSun(1.5), null)
    assert.equal(parseSun(-1), null)
    assert.equal(parseSun('1.5'), null)
    assert.equal(parseSun(Number.NaN), null)
    assert.equal(parseSun(undefined), null)
  })
})

describe('address helpers', () => {
  it('checks TRON base58 address format', () => {
    assert.equal(looksLikeTronAddress(ADDRESS), true)
    assert.equal(looksLikeTronAddress('0x' + 'a'.repeat(40)), false)
    assert.equal(looksLikeTronAddress('T' + 'l'.repeat(33)), false) // 'l' is not base58
    assert.equal(looksLikeTronAddress(ADDRESS.slice(1)), false)
  })
  it('shortens without losing the ends', () => {
    assert.equal(shortenTronAddress(ADDRESS, 6, 6), `${ADDRESS.slice(0, 6)}…${ADDRESS.slice(-6)}`)
    assert.equal(shortenTronAddress('Tshort'), 'Tshort')
  })
})

describe('fetchShastaBalance', () => {
  it('posts only to the fixed Shasta endpoint', async () => {
    let calledUrl = ''
    let calledBody = ''
    const fetchImpl: typeof fetch = async (input, init) => {
      calledUrl = String(input)
      calledBody = String(init?.body)
      return jsonResponse('{"address":"x","balance":85623170}')
    }
    const result = await fetchShastaBalance(ADDRESS, { fetchImpl, now: () => 42 })
    assert.equal(calledUrl, 'https://api.shasta.trongrid.io/wallet/getaccount')
    assert.equal(calledUrl, SHASTA_GETACCOUNT_URL)
    assert.ok(!calledUrl.includes('api.trongrid.io'))
    assert.deepEqual(JSON.parse(calledBody), { address: ADDRESS, visible: true })
    assert.deepEqual(result, { sun: 85_623_170n, hasAccountRecord: true, retrievedAt: 42 })
  })
  it('treats an empty object as no account record with a zero balance', async () => {
    const result = await fetchShastaBalance(ADDRESS, { fetchImpl: async () => jsonResponse('{}') })
    assert.equal(result.sun, 0n)
    assert.equal(result.hasAccountRecord, false)
  })
  it('treats an account record without balance as zero', async () => {
    const result = await fetchShastaBalance(ADDRESS, { fetchImpl: async () => jsonResponse('{"address":"x","create_time":1}') })
    assert.equal(result.sun, 0n)
    assert.equal(result.hasAccountRecord, true)
  })
  it('reads balances above 2^53 exactly', async () => {
    const result = await fetchShastaBalance(ADDRESS, { fetchImpl: async () => jsonResponse('{"address":"x","balance":9007199254740993}') })
    assert.equal(result.sun, 9_007_199_254_740_993n)
  })
  it('rejects bad addresses before any request', async () => {
    let called = false
    await assert.rejects(
      fetchShastaBalance('0xabc', { fetchImpl: async () => { called = true; return jsonResponse('{}') } }),
      (error: unknown) => error instanceof ShastaBalanceError && error.kind === 'invalid-address',
    )
    assert.equal(called, false)
  })
  it('surfaces HTTP, network and shape errors honestly', async () => {
    await assert.rejects(fetchShastaBalance(ADDRESS, { fetchImpl: async () => jsonResponse('{}', 503) }), (e: unknown) => e instanceof ShastaBalanceError && e.kind === 'http')
    await assert.rejects(fetchShastaBalance(ADDRESS, { fetchImpl: async () => { throw new TypeError('failed') } }), (e: unknown) => e instanceof ShastaBalanceError && e.kind === 'network')
    await assert.rejects(fetchShastaBalance(ADDRESS, { fetchImpl: async () => jsonResponse('nope') }), (e: unknown) => e instanceof ShastaBalanceError && e.kind === 'bad-response')
    await assert.rejects(fetchShastaBalance(ADDRESS, { fetchImpl: async () => jsonResponse('[]') }), (e: unknown) => e instanceof ShastaBalanceError && e.kind === 'bad-response')
    await assert.rejects(fetchShastaBalance(ADDRESS, { fetchImpl: async () => jsonResponse('{"Error":"bad"}') }), (e: unknown) => e instanceof ShastaBalanceError && e.kind === 'bad-response')
    await assert.rejects(fetchShastaBalance(ADDRESS, { fetchImpl: async () => jsonResponse('{"balance":-5}') }), (e: unknown) => e instanceof ShastaBalanceError && e.kind === 'bad-response')
    await assert.rejects(fetchShastaBalance(ADDRESS, { fetchImpl: async () => jsonResponse('{"balance":1.5}') }), (e: unknown) => e instanceof ShastaBalanceError && e.kind === 'bad-response')
  })
  it('lets aborts through unchanged', async () => {
    await assert.rejects(
      fetchShastaBalance(ADDRESS, { fetchImpl: async () => { throw new DOMException('aborted', 'AbortError') } }),
      (e: unknown) => e instanceof DOMException && e.name === 'AbortError',
    )
  })
})
