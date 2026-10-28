import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildChains, parseChainId, parseConfiguredRpcUrl, resolveChain, rpcEnvKey } from './networks.ts'

test('required networks use the correct chain IDs', () => {
  const chains = buildChains()
  const core = Object.fromEntries(chains.filter((c) => c.core).map((c) => [c.name, c.chainId]))
  assert.deepEqual(core, { 'Ethereum Mainnet': 1, Base: 8453, 'Arbitrum One': 42161, Linea: 59144 })
})

test('chain IDs parse from numbers, hex and decimal strings, and reject junk', () => {
  assert.equal(parseChainId(1), 1)
  assert.equal(parseChainId('0x2105'), 8453)
  assert.equal(parseChainId('59144'), 59144)
  for (const bad of [0, -1, 1.5, NaN, '0x', 'abc', '', null, undefined, {}, '0xZZ', Number.MAX_SAFE_INTEGER + 2]) assert.equal(parseChainId(bad), null)
})

test('resolveChain returns null for unknown chains', () => {
  const chains = buildChains()
  assert.equal(resolveChain(chains, 56), null)
  assert.equal(resolveChain(chains, '0xe708')?.name, 'Linea')
})

test('configured RPC URLs: https only, no credentials, localhost http allowed', () => {
  assert.equal(parseConfiguredRpcUrl('https://rpc.example.org/v1'), 'https://rpc.example.org/v1')
  assert.equal(parseConfiguredRpcUrl('http://rpc.example.org'), null)
  assert.equal(parseConfiguredRpcUrl('http://localhost:8545'), 'http://localhost:8545/')
  assert.equal(parseConfiguredRpcUrl('https://user:pw@rpc.example.org'), null)
  assert.equal(parseConfiguredRpcUrl('javascript:alert(1)'), null)
  assert.equal(parseConfiguredRpcUrl('not a url'), null)
  assert.equal(parseConfiguredRpcUrl('   '), null)
  assert.equal(parseConfiguredRpcUrl(undefined), null)
})

test('a configured endpoint is preferred and labelled without exposing its URL', () => {
  const chains = buildChains({ [rpcEnvKey(8453)]: 'https://base.example.org/secret-ish-path' })
  const base = chains.find((c) => c.chainId === 8453)
  assert.ok(base)
  assert.equal(base.endpoints[0].kind, 'configured')
  assert.equal(base.endpoints[0].id, 'configured-rpc')
  assert.ok(base.endpoints.length >= 2, 'public fallbacks remain')
  assert.equal(buildChains({ [rpcEnvKey(8453)]: 'http://bad.example.org' }).find((c) => c.chainId === 8453)?.endpoints[0].kind, 'public')
})
