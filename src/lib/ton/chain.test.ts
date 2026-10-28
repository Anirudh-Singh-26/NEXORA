import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyTonChain, evaluateTonBalanceGate, TON_MAINNET_CHAIN, TON_NETWORK_LABEL, TON_TESTNET_CHAIN } from './chain.ts'

const ADDRESS = `0:${'ab'.repeat(32)}`

test('chain constants match the TON Connect CHAIN values', () => {
  assert.equal(TON_MAINNET_CHAIN, '-239')
  assert.equal(TON_TESTNET_CHAIN, '-3')
})

test('classifyTonChain identifies testnet only for the exact testnet value', () => {
  assert.deepEqual(classifyTonChain('-3'), { kind: 'testnet', chain: '-3', verifiedTestnet: true })
  assert.equal(TON_NETWORK_LABEL[classifyTonChain('-3').kind], 'TON Testnet')
})

test('classifyTonChain identifies mainnet and never calls it testnet', () => {
  const identity = classifyTonChain('-239')
  assert.equal(identity.kind, 'mainnet')
  assert.equal(identity.verifiedTestnet, false)
})

test('classifyTonChain treats every other value as unknown', () => {
  for (const value of [undefined, null, '', ' -3', '-3 ', '3', '-4', '0', 'testnet', 'TESTNET', -3, -239, {}, [], true]) {
    const identity = classifyTonChain(value)
    assert.equal(identity.kind, 'unknown', `value ${JSON.stringify(value)}`)
    assert.equal(identity.verifiedTestnet, false)
  }
  assert.equal(classifyTonChain('-4').chain, '-4')
  assert.equal(classifyTonChain(-3).chain, null)
})

test('gate allows a restored, connected, testnet wallet with a valid raw address', () => {
  assert.deepEqual(evaluateTonBalanceGate({ restored: true, chain: '-3', address: ADDRESS }), { allowed: true, address: ADDRESS })
})

test('gate blocks mainnet and unknown networks so no testnet balance is requested', () => {
  assert.deepEqual(evaluateTonBalanceGate({ restored: true, chain: '-239', address: ADDRESS }), { allowed: false, reason: 'mainnet' })
  for (const chain of [undefined, null, '', '-4', 'testnet', -3]) {
    assert.deepEqual(evaluateTonBalanceGate({ restored: true, chain, address: ADDRESS }), { allowed: false, reason: 'unknown-network' })
  }
})

test('gate blocks while the session is restoring and when disconnected', () => {
  assert.deepEqual(evaluateTonBalanceGate({ restored: false, chain: '-3', address: ADDRESS }), { allowed: false, reason: 'restoring' })
  assert.deepEqual(evaluateTonBalanceGate({ restored: true, chain: '-3', address: null }), { allowed: false, reason: 'disconnected' })
  assert.deepEqual(evaluateTonBalanceGate({ restored: true, chain: '-3', address: '' }), { allowed: false, reason: 'disconnected' })
})

test('gate blocks a testnet wallet that reports a malformed address', () => {
  for (const address of ['0:abc', 'EQ-not-raw', `2:${'ab'.repeat(32)}`, `0:${'zz'.repeat(32)}`]) {
    assert.deepEqual(evaluateTonBalanceGate({ restored: true, chain: '-3', address }), { allowed: false, reason: 'invalid-address' })
  }
})
