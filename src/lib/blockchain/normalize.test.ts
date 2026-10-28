import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BlockchainError } from './errors.ts'
import { formatUnits, normalizeAddress, normalizeBalance, normalizeSnapshot, parseQuantity } from './normalize.ts'

test('parseQuantity accepts canonical hex quantities only', () => {
  assert.equal(parseQuantity('0x0'), 0n)
  assert.equal(parseQuantity('0x10'), 16n)
  for (const bad of ['0x', '0x00', '0x01', '10', 16, null, undefined, '0xzz', {}]) {
    assert.throws(() => parseQuantity(bad), (e: unknown) => e instanceof BlockchainError && e.kind === 'malformed')
  }
})

test('formatUnits truncates instead of rounding', () => {
  assert.equal(formatUnits(1_500_000_000n, 9, 4), '1.5')
  assert.equal(formatUnits(1_999_999_999n, 9, 4), '1.9999')
  assert.equal(formatUnits(0n, 18, 6), '0')
  assert.equal(formatUnits(10n ** 18n, 18, 6), '1')
  assert.equal(formatUnits(1n, 18, 6), '0')
})

test('normalizeSnapshot converts hex to typed values', () => {
  assert.deepEqual(normalizeSnapshot(1, '0x1312d00', '0x3b9aca00'), { chainId: 1, blockNumber: 20_000_000, gasPriceWei: '1000000000', gasPriceGwei: '1' })
  assert.throws(() => normalizeSnapshot(1, '0x1', 'oops'), BlockchainError)
  assert.throws(() => normalizeSnapshot(1, '0xffffffffffffffffff', '0x1'), BlockchainError)
})

test('normalizeBalance formats native units', () => {
  const b = normalizeBalance(1, '0xabc', '0xde0b6b3a7640000', 18, 'ETH')
  assert.equal(b.balanceWei, '1000000000000000000')
  assert.equal(b.balanceFormatted, '1')
})

test('normalizeAddress validates and lowercases', () => {
  const a = '0x' + 'AbCdEf'.repeat(6) + 'abcd'
  assert.equal(normalizeAddress(a), a.toLowerCase())
  for (const bad of ['0x123', '', null, 5, '0x' + 'g'.repeat(40), 'ab'.repeat(20)]) assert.equal(normalizeAddress(bad), null)
})
