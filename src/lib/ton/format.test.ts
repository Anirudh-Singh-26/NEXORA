import assert from 'node:assert/strict'
import test from 'node:test'
import { isRawTonAddress, shortenTonAddress, tonTestnetAddressUrl } from './address.ts'
import { formatNanoTon, formatNanoTonUnits, NANO_PER_TON, parseNanoTon } from './format.ts'

test('NANO_PER_TON is 1e9', () => {
  assert.equal(NANO_PER_TON, 1_000_000_000n)
})

test('parseNanoTon accepts decimal digit strings and safe non-negative integers', () => {
  assert.equal(parseNanoTon('0'), 0n)
  assert.equal(parseNanoTon('1500000000'), 1_500_000_000n)
  assert.equal(parseNanoTon('5000000000000000000'), 5_000_000_000_000_000_000n)
  assert.equal(parseNanoTon(42), 42n)
})

test('parseNanoTon rejects everything that is not a whole non-negative amount', () => {
  const bad: unknown[] = ['', ' 1', '1 ', '-1', '1.5', '1e9', '0x10', 'abc', '١٢٣', '1'.repeat(31), -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, undefined, {}, [], true, 10n]
  for (const value of bad) assert.equal(parseNanoTon(value), null, `value ${String(value)}`)
})

test('formatNanoTon converts with integer arithmetic and never rounds', () => {
  assert.equal(formatNanoTon(0n), '0.00')
  assert.equal(formatNanoTon(1n), '0.000000001')
  assert.equal(formatNanoTon(999_999_999n), '0.999999999')
  assert.equal(formatNanoTon(1_000_000_000n), '1.00')
  assert.equal(formatNanoTon(1_500_000_000n), '1.50')
  assert.equal(formatNanoTon(1_234_567_891n), '1.234567891')
  assert.equal(formatNanoTon(120_000_000n), '0.12')
  assert.equal(formatNanoTon(1_234_567_890_123_456_789n), '1,234,567,890.123456789')
})

test('formatNanoTon is exact beyond 2^53 where floating point would drift', () => {
  const nano = 9_007_199_254_740_993n // 2^53 + 1
  assert.equal(formatNanoTon(nano), '9,007,199.254740993')
  // A double cannot even hold this nanoTON value, which is why bigint is the source of truth.
  assert.notEqual(BigInt(Number(nano)), nano)
})

test('formatNanoTon honours minFractionDigits and rejects negatives', () => {
  assert.equal(formatNanoTon(2_000_000_000n, 0), '2')
  assert.equal(formatNanoTon(2_000_000_000n, 4), '2.0000')
  assert.throws(() => formatNanoTon(-1n), RangeError)
  assert.throws(() => formatNanoTonUnits(-1n), RangeError)
})

test('formatNanoTonUnits groups thousands', () => {
  assert.equal(formatNanoTonUnits(0n), '0')
  assert.equal(formatNanoTonUnits(1_234_567_890n), '1,234,567,890')
})

test('isRawTonAddress accepts workchain 0 and -1 only, with 64 hex characters', () => {
  assert.equal(isRawTonAddress(`0:${'ab'.repeat(32)}`), true)
  assert.equal(isRawTonAddress(`-1:${'AB'.repeat(32)}`), true)
  for (const value of [`1:${'ab'.repeat(32)}`, `0:${'ab'.repeat(31)}`, `0:${'ab'.repeat(33)}`, `0:${'gg'.repeat(32)}`, 'EQ' + 'A'.repeat(46), '', null, undefined, 5]) assert.equal(isRawTonAddress(value), false)
})

test('shortenTonAddress keeps head and tail and leaves short strings alone', () => {
  assert.equal(shortenTonAddress('0Q' + 'A'.repeat(44) + 'WXYZ12', 6, 6), '0QAAAA…WXYZ12')
  assert.equal(shortenTonAddress('short'), 'short')
})

test('tonTestnetAddressUrl points at the testnet explorer and encodes the address', () => {
  assert.equal(tonTestnetAddressUrl('0QAbc_-d'), 'https://testnet.tonviewer.com/0QAbc_-d')
  assert.equal(tonTestnetAddressUrl('0:ab'), 'https://testnet.tonviewer.com/0%3Aab')
})
