import assert from 'node:assert/strict'
import test from 'node:test'
import {
  confirmationNotice,
  initialTonTransferFlow,
  tonTransferFlowReducer as reduce,
  type TonTransferFlowState,
} from './transfer-flow.ts'
import type { TonConfirmationResult } from './confirmation.ts'

const TRACKED = { hash: 'ee'.repeat(32), account: `0:${'aa'.repeat(32)}` }
const HASH = '11'.repeat(32)

/** Drive the reducer to the 'confirming' phase exactly as the form does after the wallet accepts the request. */
function confirming(): TonTransferFlowState {
  let s = reduce(initialTonTransferFlow, { type: 'review', review: { recipient: 'kQrecipient', amountNano: 100_000_000n } })
  s = reduce(s, { type: 'fetch-baseline' })
  s = reduce(s, { type: 'baseline-ok', baselineLt: 1000n })
  return reduce(s, { type: 'start-confirming', senderAddress: '0:sender', tracked: TRACKED })
}
const unverified: TonConfirmationResult = { status: 'confirmation-unknown', reason: 'delivery-pending', lt: '2000', hash: HASH }

test('confirmed success: clear success notice, explorer link, and no unresolved warning or retry context', () => {
  const s = reduce(confirming(), { type: 'confirmation', result: { status: 'confirmed', lt: '2000', hash: HASH, executionResult: 'success' } })
  assert.equal(s.phase, 'editing')
  assert.equal(s.notice?.tone, 'success')
  assert.match(s.notice?.message ?? '', /confirmed/i)
  assert.doesNotMatch(s.notice?.message ?? '', /could not be determined/)
  assert.equal(s.notice?.explorerUrl, `https://testnet.tonviewer.com/transaction/${HASH}`)
  assert.equal(s.retryContext, null)   // final: the "Retry lookup" button disappears
})

test('confirmed failure: error tone, distinguishes wallet failure from recipient bounce, no retry', () => {
  const wallet = reduce(confirming(), { type: 'confirmation', result: { status: 'on-chain-failed', lt: '2000', hash: HASH, executionResult: 'failed', stage: 'wallet' } })
  assert.equal(wallet.notice?.tone, 'error')
  assert.match(wallet.notice?.message ?? '', /execution failed/)
  assert.equal(wallet.retryContext, null)
  const delivery = reduce(confirming(), { type: 'confirmation', result: { status: 'on-chain-failed', lt: '2000', hash: HASH, executionResult: 'failed', stage: 'delivery' } })
  assert.equal(delivery.notice?.tone, 'error')
  assert.match(delivery.notice?.message ?? '', /recipient/)
})

test('pending / unavailable lookups stay honest (info, not success or failure) and keep Retry available', () => {
  for (const result of [
    unverified,
    { status: 'confirmation-unknown', reason: 'timeout' },
    { status: 'confirmation-unknown', reason: 'unavailable' },
    { status: 'execution-unknown', lt: '2000', hash: HASH, executionResult: 'unknown' },
  ] as TonConfirmationResult[]) {
    const s = reduce(confirming(), { type: 'confirmation', result })
    assert.equal(s.phase, 'editing')
    assert.equal(s.notice?.tone, 'info')
    assert.deepEqual(s.retryContext?.tracked, TRACKED)
    assert.doesNotMatch(s.notice?.message ?? '', /successfully\.?$/)
  }
  assert.match(confirmationNotice({ status: 'confirmation-unknown', reason: 'unavailable' }).message, /could not be reached/)
  assert.match(confirmationNotice(unverified).message, /unverified/)
  assert.equal(confirmationNotice({ status: 'confirmation-unknown', reason: 'timeout' }).explorerUrl, null)
})

test('Retry lookup re-enters confirming for the SAME submission and clears the stale warning', () => {
  const stuck = reduce(confirming(), { type: 'confirmation', result: unverified })
  assert.ok(stuck.notice)
  const retrying = reduce(stuck, { type: 'retry-confirmation' })
  assert.equal(retrying.phase, 'confirming')
  assert.equal(retrying.notice, null)                      // stale warning gone while re-checking
  assert.equal(retrying.retryContext, stuck.retryContext)  // same tracked identity, nothing re-created
  assert.equal(retrying.lookupAttempt, stuck.lookupAttempt + 1)
  assert.equal(retrying.review, null)                      // no review/send path is re-entered
})

test('Retry lookup resolves the existing status: unverified -> confirmed replaces the warning with success', () => {
  const stuck = reduce(confirming(), { type: 'confirmation', result: unverified })
  const retrying = reduce(stuck, { type: 'retry-confirmation' })
  const done = reduce(retrying, { type: 'confirmation', result: { status: 'confirmed', lt: '2000', hash: HASH, executionResult: 'success' } })
  assert.equal(done.notice?.tone, 'success')
  assert.equal(done.retryContext, null)
  assert.equal(done.lookupAttempt, 0)
})

test('Retry lookup never creates a second submission: ignored while confirming, after final results, or with no context', () => {
  const stuck = reduce(confirming(), { type: 'confirmation', result: unverified })
  const retrying = reduce(stuck, { type: 'retry-confirmation' })
  assert.equal(reduce(retrying, { type: 'retry-confirmation' }), retrying)          // double click
  const final = reduce(retrying, { type: 'confirmation', result: { status: 'confirmed', lt: '2000', hash: HASH, executionResult: 'success' } })
  assert.equal(reduce(final, { type: 'retry-confirmation' }), final)                // nothing to retry
  assert.equal(reduce(initialTonTransferFlow, { type: 'retry-confirmation' }), initialTonTransferFlow)
  // 'start-confirming' (the only action that arms a lookup) is only accepted straight after a wallet-accepted send.
  assert.equal(reduce(stuck, { type: 'start-confirming', senderAddress: '0:sender', tracked: TRACKED }), stuck)
})

test('a late confirmation result after dismissal/other phases is ignored', () => {
  const s = reduce(confirming(), { type: 'confirmation', result: unverified })
  assert.equal(reduce(s, { type: 'confirmation', result: { status: 'confirmed', lt: '2000', hash: HASH, executionResult: 'success' } }), s)
})
