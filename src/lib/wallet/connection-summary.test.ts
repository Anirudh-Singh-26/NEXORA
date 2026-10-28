import assert from 'node:assert/strict'
import test from 'node:test'
import { CHECKING_SUMMARY, nextStoredSummary, sameSummary, type ChainConnectionSummary } from './connection-summary.ts'

const connect = () => undefined
const base: ChainConnectionSummary = { phase: 'connected', walletName: 'Tonkeeper', address: 'kQ…', networkLabel: 'TON Testnet', networkSupported: true, chain: '-3', networkKind: 'testnet', connect, disconnect: connect, disconnecting: false }

test('an identical report (even as a fresh object) keeps the stored object, so subscribers are not notified', () => {
  const stored = { ...base }
  assert.equal(nextStoredSummary(stored, { ...base }), stored)
  assert.equal(nextStoredSummary(CHECKING_SUMMARY, null), CHECKING_SUMMARY)
  assert.equal(nextStoredSummary(CHECKING_SUMMARY, { ...CHECKING_SUMMARY }), CHECKING_SUMMARY)
})

test('a real change, or a different callback identity, is stored', () => {
  const stored = { ...base }
  assert.notEqual(nextStoredSummary(stored, { ...base, phase: 'disconnected' }), stored)
  assert.notEqual(nextStoredSummary(stored, { ...base, address: 'other' }), stored)
  // Callback identity matters: this is why the TON panel must hand over stable callbacks.
  assert.equal(sameSummary(base, { ...base, connect: () => undefined }), false)
  assert.equal(nextStoredSummary(stored, null), CHECKING_SUMMARY)
})

test('repeated identical reports never produce more than one store update', () => {
  let current: ChainConnectionSummary = CHECKING_SUMMARY
  let updates = 0
  for (let i = 0; i < 50; i += 1) {
    const next = nextStoredSummary(current, { ...base })
    if (next !== current) { updates += 1; current = next }
  }
  assert.equal(updates, 1)
})
