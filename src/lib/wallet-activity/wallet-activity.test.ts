import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildChains } from '../blockchain/networks.ts'
import { ACTIVITY_CHAINS, evmAddressUrl, evmTxUrl, isActivityChain, solanaTxUrl } from './chains.ts'
import {
  directionFor, fetchEvmActivity, fetchSolanaActivity, filterEvm, filterSolana, kindsFor, parseEvmActivityResponse, parseSolanaActivityResponse,
  resolveActivityTarget, timeGroup, type EvmEntry,
} from './wallet-activity.ts'

const ME = '0xabcdef0123456789abcdef0123456789abcdef01'
const OTHER = '0x1111111111111111111111111111111111111111'
const SOL = '11111111111111111111111111111112'
const OTHER_SOL = '11111111111111111111111111111113'
const hash = (n: number) => '0x' + n.toString(16).padStart(64, '0')
const sig = (n: number) => `${'5'.repeat(86)}${'ABCDEFGH'[n % 8]}z`
const json = (body: unknown, status = 200, type = 'application/json') => new Response(JSON.stringify(body), { status, headers: { 'content-type': type } })
const transfer = (over: Record<string, unknown> = {}) => ({ category: 'external', from: ME, to: OTHER, asset: 'ETH', amount: '1.5', contract: null, tokenId: null, ...over })
const entry = (n: number, transfers: unknown[], timestamp: string | null = '2025-01-02T03:04:05.000Z'): EvmEntry => parseEvmActivityResponse({ chainId: 1, address: ME, items: [{ hash: hash(n), blockNumber: n, timestamp, transfers }], nextCursor: null }).items[0]

test('explorer links come only from the fixed chain table and match the app network config', () => {
  for (const [id, chain] of Object.entries(ACTIVITY_CHAINS)) {
    const config = buildChains().find((c) => c.chainId === Number(id))
    assert.ok(config, `chain ${id} missing from blockchain config`)
    assert.equal(chain.explorer, config.explorerUrl)
  }
  assert.equal(evmTxUrl(1, hash(7).toUpperCase().replace('0X', '0x')), `https://etherscan.io/tx/${hash(7)}`)
  assert.equal(evmTxUrl(8453, hash(7)), `https://basescan.org/tx/${hash(7)}`)
  assert.equal(evmTxUrl(59144, hash(7)), null)
  assert.equal(evmTxUrl(1, '0x12'), null)
  assert.equal(evmTxUrl(1, `${hash(7)}/../x`), null)
  assert.equal(evmAddressUrl(137, OTHER), `https://polygonscan.com/address/${OTHER}`)
  assert.equal(solanaTxUrl(sig(1)), `https://explorer.solana.com/tx/${sig(1)}?cluster=devnet`) // Devnet explorer, never a mainnet one
  assert.equal(solanaTxUrl('javascript:alert(1)'), null)
  assert.equal(isActivityChain(59144), false)
})

test('resolveActivityTarget: account, network and ecosystem selection', () => {
  assert.deepEqual(resolveActivityTarget({ ecosystem: null, address: null, chainId: null }), { kind: 'no-wallet' })
  assert.deepEqual(resolveActivityTarget({ ecosystem: 'evm', address: 'nope', chainId: 1 }), { kind: 'invalid-address' })
  assert.deepEqual(resolveActivityTarget({ ecosystem: 'evm', address: ME, chainId: null }), { kind: 'unknown-network' })
  assert.equal(resolveActivityTarget({ ecosystem: 'evm', address: ME, chainId: 59144 }).kind, 'unsupported-network')
  const evm = resolveActivityTarget({ ecosystem: 'evm', address: ME.toUpperCase().replace('0X', '0x'), chainId: 8453 })
  assert.deepEqual(evm, { kind: 'ready', ecosystem: 'evm', chainId: 8453, address: ME, key: `evm:8453:${ME}` })
  // Solana: no solanaNetworkName (undefined) is backward-compat — no network constraint, passes through to ready.
  const sol = resolveActivityTarget({ ecosystem: 'solana', address: SOL, chainId: 1 })
  assert.deepEqual(sol, { kind: 'ready', ecosystem: 'solana', address: SOL, key: `solana-devnet:${SOL}` })
  // Solana: null means wallet connected but did not report network — must NOT query mainnet blindly.
  assert.equal(resolveActivityTarget({ ecosystem: 'solana', address: SOL, chainId: null, solanaNetworkName: null }).kind, 'unknown-network')
  // An EVM address is never accepted as Solana and vice versa; a Solana wallet ignores the EVM chain ID.
  assert.equal(resolveActivityTarget({ ecosystem: 'solana', address: ME, chainId: 1 }).kind, 'invalid-address')
  assert.equal(resolveActivityTarget({ ecosystem: 'evm', address: SOL, chainId: 1 }).kind, 'invalid-address')
  // Devnet is the ONLY Solana cluster whose history is requested.
  assert.equal(resolveActivityTarget({ ecosystem: 'solana', address: SOL, chainId: null, solanaNetworkName: 'Solana Devnet' }).kind, 'ready')
  assert.equal(resolveActivityTarget({ ecosystem: 'solana', address: SOL, chainId: null, solanaNetworkName: 'devnet' }).kind, 'ready')
  // Mainnet (AppKit names it exactly "Solana"), Testnet and anything else make NO request and say why.
  for (const name of ['Solana', 'mainnet-beta', 'Solana Testnet', 'Some Other Cluster']) {
    const target = resolveActivityTarget({ ecosystem: 'solana', address: SOL, chainId: null, solanaNetworkName: name })
    assert.equal(target.kind, 'unsupported-network', name)
    assert.match(target.kind === 'unsupported-network' ? target.reason : '', /Devnet only/, name)
  }
  // Different chain or account => different key, so cached rows can never be reused across them.
  const keys = new Set([evm, resolveActivityTarget({ ecosystem: 'evm', address: ME, chainId: 1 }), resolveActivityTarget({ ecosystem: 'evm', address: OTHER, chainId: 8453 })].map((t) => t.kind === 'ready' ? t.key : ''))
  assert.equal(keys.size, 3)
})


test('parseEvmActivityResponse: drops malformed rows, tolerates missing timestamp/amount, validates cursor', () => {
  const page = parseEvmActivityResponse({
    chainId: 1, address: ME.toUpperCase().replace('0X', '0x'), nextCursor: '123',
    items: [
      { hash: hash(1), blockNumber: 5, timestamp: null, transfers: [transfer({ amount: null })] },
      { hash: hash(1), blockNumber: 5, timestamp: null, transfers: [transfer()] },
      { hash: 'bad', blockNumber: 5, timestamp: null, transfers: [transfer()] },
      { hash: hash(2), blockNumber: -1, timestamp: null, transfers: [transfer()] },
      { hash: hash(3), blockNumber: 5, timestamp: 'not a date', transfers: [transfer({ category: 'bogus' })] },
      { hash: hash(4), blockNumber: 5, timestamp: 'not a date', transfers: [transfer({ amount: '1e9' }), transfer({ category: 'erc721', from: null, to: ME, contract: USDC(), tokenId: '42', amount: null })] },
      null,
    ],
  })
  assert.equal(page.address, ME)
  assert.deepEqual(page.items.map((i) => i.hash), [hash(1), hash(4)])
  assert.equal(page.items[0].timestamp, null)
  assert.equal(page.items[0].transfers[0].amount, null)
  assert.equal(page.items[1].timestamp, null)
  assert.equal(page.items[1].transfers[0].amount, null)
  assert.equal(page.items[1].transfers[1].tokenId, '42')
  assert.equal(page.nextCursor, '123')
  assert.equal(parseEvmActivityResponse({ chainId: 1, address: ME, items: [], nextCursor: '12; drop' }).nextCursor, null)
  assert.throws(() => parseEvmActivityResponse({ chainId: 1, address: ME }))
  assert.throws(() => parseEvmActivityResponse(null))
})
function USDC() { return '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' }

test('fetchEvmActivity: success, empty, cursor, wrong account/chain rejected, safe errors', async () => {
  const ok = { chainId: 1, address: ME, items: [{ hash: hash(1), blockNumber: 1, timestamp: null, transfers: [transfer()] }], nextCursor: '77' }
  let seen = ''
  const good = ((url: string) => { seen = url; return Promise.resolve(json(ok)) }) as unknown as typeof fetch
  const first = await fetchEvmActivity(1, ME, { fetchImpl: good, cursor: '99' })
  assert.equal(first.status === 'ok' && first.nextCursor, '77')
  assert.ok(seen.startsWith('/api/wallet-activity?') && seen.includes('cursor=99') && seen.includes(`address=${ME}`))

  const empty = await fetchEvmActivity(1, ME, { fetchImpl: (() => Promise.resolve(json({ ...ok, items: [], nextCursor: null }))) as typeof fetch })
  assert.deepEqual(empty, { status: 'ok', items: [], nextCursor: null })

  const wrongChain = await fetchEvmActivity(8453, ME, { fetchImpl: (() => Promise.resolve(json(ok))) as typeof fetch })
  assert.equal(wrongChain.status === 'error' && wrongChain.kind, 'malformed')
  const wrongAccount = await fetchEvmActivity(1, OTHER, { fetchImpl: (() => Promise.resolve(json(ok))) as typeof fetch })
  assert.equal(wrongAccount.status === 'error' && wrongAccount.kind, 'malformed')

  const calls: number[] = []
  const never = (() => { calls.push(1); return Promise.resolve(json(ok)) }) as typeof fetch
  assert.equal((await fetchEvmActivity(59144, ME, { fetchImpl: never })).status, 'error')
  assert.equal((await fetchEvmActivity(1, 'nope', { fetchImpl: never })).status, 'error')
  assert.equal((await fetchEvmActivity(1, ME, { fetchImpl: never, cursor: 'x' })).status, 'error')
  assert.equal(calls.length, 0)

  const kind = async (response: () => Response | Promise<Response>) => {
    const r = await fetchEvmActivity(1, ME, { fetchImpl: (() => Promise.resolve().then(response)) as typeof fetch })
    return r.status === 'error' ? [r.kind, r.retryable] : ['ok', false]
  }
  assert.deepEqual(await kind(() => json({ error: { code: 'rate-limited' } }, 429)), ['rate-limited', true])
  assert.deepEqual(await kind(() => json({ error: { code: 'not-configured' } }, 503)), ['not-configured', false])
  assert.deepEqual(await kind(() => json({ error: { code: 'chain-unsupported' } }, 422)), ['chain-unsupported', false])
  assert.deepEqual(await kind(() => json({ error: { code: 'weird' } }, 500)), ['upstream', true])
  assert.deepEqual(await kind(() => new Response('<html>', { headers: { 'content-type': 'text/html' } })), ['proxy-missing', false])
  assert.deepEqual(await kind(() => new Response('{bad', { headers: { 'content-type': 'application/json' } })), ['malformed', true])
  assert.deepEqual(await kind(() => { throw new TypeError('offline') }), ['network', true])
})

test('fetchEvmActivity: aborted signal and timeout', async () => {
  const controller = new AbortController()
  controller.abort()
  const aborted = await fetchEvmActivity(1, ME, { signal: controller.signal, fetchImpl: (() => Promise.resolve(json({}))) as typeof fetch })
  assert.equal(aborted.status === 'error' && aborted.kind, 'aborted')
  const hang = ((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch
  const timedOut = await fetchEvmActivity(1, ME, { fetchImpl: hang, timeoutMs: 10 })
  assert.equal(timedOut.status === 'error' && timedOut.kind, 'timeout')
})

test('Solana: parse, fetch, wrong address rejected, missing time/status tolerated', async () => {
  const body = { cluster: 'devnet', address: SOL, nextCursor: sig(2), items: [{ signature: sig(1), slot: 5, blockTime: null, status: 'failed', confirmation: 'finalized' }, { signature: sig(2), slot: 4, blockTime: 1_700_000_000, status: 'weird', confirmation: null }, { signature: 'bad', slot: 1 }] }
  const page = parseSolanaActivityResponse(body)
  assert.deepEqual(page.items.map((i) => [i.status, i.blockTime]), [['failed', null], [null, 1_700_000_000]])
  const ok = await fetchSolanaActivity(SOL, { fetchImpl: (() => Promise.resolve(json(body))) as typeof fetch })
  assert.equal(ok.status === 'ok' && ok.items.length, 2)
  const wrong = await fetchSolanaActivity(SOL, { fetchImpl: (() => Promise.resolve(json({ ...body, address: '11111111111111111111111111111113' }))) as typeof fetch })
  assert.equal(wrong.status === 'error' && wrong.kind, 'malformed')
  assert.equal((await fetchSolanaActivity(ME, { fetchImpl: (() => Promise.resolve(json(body))) as typeof fetch })).status, 'error')
  // A response that does not declare Devnet (e.g. an older mainnet-pinned proxy) is refused, never displayed.
  for (const cluster of ['mainnet-beta', undefined, 'testnet']) {
    const refused = await fetchSolanaActivity(SOL, { fetchImpl: (() => Promise.resolve(json({ ...body, cluster }))) as typeof fetch })
    assert.equal(refused.status === 'error' && refused.kind, 'malformed', String(cluster))
  }
})

test('Solana: details are validated; an amount is only kept for a plain transfer; malformed details become null', () => {
  const details = { kind: 'transfer', direction: 'sent', counterparty: OTHER_SOL, lamports: '500000000', netChangeLamports: '-500005000', feeLamports: '5000' }
  const page = parseSolanaActivityResponse({ cluster: 'devnet', address: SOL, items: [
    { signature: sig(1), slot: 1, blockTime: 1, status: 'success', confirmation: 'finalized', details },
    { signature: sig(2), slot: 1, blockTime: 1, status: 'success', confirmation: 'finalized', details: { ...details, kind: 'other' } }, // amount on a non-transfer: refused
    { signature: sig(3), slot: 1, blockTime: 1, status: 'success', confirmation: 'finalized', details: { ...details, lamports: '1.5' } },
    { signature: sig(4), slot: 1, blockTime: 1, status: 'success', confirmation: 'finalized', details: { ...details, direction: 'sideways' } },
    { signature: sig(5), slot: 1, blockTime: 1, status: 'success', confirmation: 'finalized' },
  ] })
  assert.deepEqual(page.items[0].details, details)
  assert.equal(page.items[1].details, null)
  assert.equal(page.items[2].details?.lamports, null)
  assert.equal(page.items[3].details, null)
  assert.equal(page.items[4].details, null)
})

test('direction, kinds, time groups and filters', () => {
  const sent = entry(1, [transfer(), transfer({ category: 'erc20', from: OTHER, to: ME, asset: 'USDC', contract: USDC(), amount: '5' })])
  const received = entry(2, [transfer({ from: OTHER, to: ME })], null)
  const self = entry(3, [transfer({ from: ME, to: ME })])
  const nft = entry(4, [transfer({ category: 'erc721', from: OTHER, to: ME, contract: USDC(), tokenId: '9', amount: null, asset: null })])
  assert.deepEqual([sent, received, self, nft].map((e) => directionFor(e, ME.toUpperCase().replace('0X', '0x'))), ['sent', 'received', 'self', 'received'])
  assert.deepEqual(kindsFor(sent), ['native', 'token'])
  const now = new Date('2025-01-02T12:00:00')
  assert.equal(timeGroup(null, now), 'Date unavailable')
  assert.equal(timeGroup('garbage', now), 'Date unavailable')
  assert.equal(timeGroup(new Date('2025-01-02T03:04:05').toISOString(), now), 'Today')
  assert.equal(timeGroup('2024-12-30T00:00:00.000Z', now), 'Earlier')
  const all = [sent, received, self, nft]
  const base = { kind: 'all', time: 'all', query: '' } as const
  assert.equal(filterEvm(all, { ...base, kind: 'nft' }).length, 1)
  assert.equal(filterEvm(all, { ...base, kind: 'token' }).length, 1)
  assert.equal(filterEvm(all, { ...base, kind: 'native' }).length, 3)
  assert.equal(filterEvm(all, { ...base, query: 'usdc' }).length, 1)
  assert.equal(filterEvm(all, { ...base, query: hash(3) }).length, 1)
  assert.equal(filterEvm(all, { ...base, time: 'Today' }, now).length, 3) // the row without a timestamp is not "Today"
  assert.equal(filterEvm(all, { ...base, time: 'Earlier' }, now).length, 0)
  const solRows = parseSolanaActivityResponse({ cluster: 'devnet', address: SOL, items: [{ signature: sig(1), slot: 1, blockTime: null, status: null, confirmation: null }] }).items
  assert.equal(filterSolana(solRows, { time: 'Today', query: '' }).length, 0)
  assert.equal(filterSolana(solRows, { time: 'all', query: sig(1).slice(0, 10) }).length, 1)
})
