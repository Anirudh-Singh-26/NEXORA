import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBlockchainClient } from './client.ts'
import { groupDecimal, resolveBalanceTarget } from './wallet-balance.ts'

const chains = createBlockchainClient().listChains()
const ADDRESS = '0xAbCdEf0123456789abcdef0123456789ABCDEF01'

test('no account → no-wallet, regardless of chain', () => {
  assert.deepEqual(resolveBalanceTarget(null, 1, chains), { kind: 'no-wallet' })
})

test('malformed address is rejected before any request', () => {
  assert.deepEqual(resolveBalanceTarget('0x123', 1, chains), { kind: 'invalid-address' })
})

test('connected but chain not read → unknown-network', () => {
  assert.deepEqual(resolveBalanceTarget(ADDRESS, null, chains), { kind: 'unknown-network' })
})

test('chain outside the data layer → unsupported-network with its id', () => {
  assert.deepEqual(resolveBalanceTarget(ADDRESS, 56, chains), { kind: 'unsupported-network', chainId: 56 })
})

test('supported chain → ready with lowercased address and chain config', () => {
  const target = resolveBalanceTarget(ADDRESS, 137, chains)
  assert.equal(target.kind, 'ready')
  if (target.kind !== 'ready') return
  assert.equal(target.address, ADDRESS.toLowerCase())
  assert.equal(target.chain.nativeSymbol, 'POL')
})

test('every wallet-recognised chain is readable by the data layer', () => {
  for (const id of [1, 11155111, 137, 8453, 42161, 10, 59144]) assert.equal(resolveBalanceTarget(ADDRESS, id, chains).kind, 'ready', `chain ${id}`)
})

test('groupDecimal groups the whole part only and never rounds', () => {
  assert.equal(groupDecimal('0'), '0')
  assert.equal(groupDecimal('1234567.123456'), '1,234,567.123456')
  assert.equal(groupDecimal('999.5'), '999.5')
  assert.equal(groupDecimal('1000'), '1,000')
})

test('getNativeBalance for a resolved target formats wei exactly and reports the symbol', async () => {
  const impl = ((_input: RequestInfo | URL, init?: RequestInit) => {
    const { method } = JSON.parse(String(init?.body)) as { method: string }
    const result = method === 'eth_chainId' ? '0x89' : '0x1bc16d674ec80000' // 2 POL
    return Promise.resolve(new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result })))
  }) as typeof fetch
  const client = createBlockchainClient({ fetch: impl })
  const target = resolveBalanceTarget(ADDRESS, 137, client.listChains())
  assert.equal(target.kind, 'ready')
  if (target.kind !== 'ready') return
  const result = await client.getNativeBalance(target.chainId, target.address)
  assert.equal(result.status, 'ok')
  if (result.status !== 'ok') return
  assert.equal(result.data.balanceFormatted, '2')
  assert.equal(result.data.symbol, 'POL')
})
