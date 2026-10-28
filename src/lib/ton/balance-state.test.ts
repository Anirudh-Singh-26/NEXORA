import assert from 'node:assert/strict'
import test from 'node:test'
import type { TonBalance } from './balance.ts'
import { initialTonBalanceState, selectTonBalanceView, tonBalanceKey, tonBalanceReducer, type TonBalanceState } from './balance-state.ts'

const A = `0:${'aa'.repeat(32)}`
const B = `0:${'bb'.repeat(32)}`
const balanceOf = (address: string, nano: bigint): TonBalance => ({ nano, address, retrievedAt: 1 })

test('start -> success shows the balance', () => {
  let state: TonBalanceState = tonBalanceReducer(initialTonBalanceState, { type: 'start', key: tonBalanceKey(A), requestId: 1 })
  assert.deepEqual(state.view, { status: 'loading', previous: null })
  state = tonBalanceReducer(state, { type: 'success', key: tonBalanceKey(A), requestId: 1, balance: balanceOf(A, 5n) })
  assert.equal(state.view.status, 'ready')
})

test('a late response from an older request is ignored', () => {
  let state = tonBalanceReducer(initialTonBalanceState, { type: 'start', key: tonBalanceKey(A), requestId: 1 })
  state = tonBalanceReducer(state, { type: 'start', key: tonBalanceKey(A), requestId: 2 })
  const afterStale = tonBalanceReducer(state, { type: 'success', key: tonBalanceKey(A), requestId: 1, balance: balanceOf(A, 111n) })
  assert.equal(afterStale, state)
  const afterFresh = tonBalanceReducer(state, { type: 'success', key: tonBalanceKey(A), requestId: 2, balance: balanceOf(A, 222n) })
  assert.deepEqual(afterFresh.view, { status: 'ready', balance: balanceOf(A, 222n) })
})

test('a late response for a previous account is ignored and never displayed for the new one', () => {
  let state = tonBalanceReducer(initialTonBalanceState, { type: 'start', key: tonBalanceKey(A), requestId: 1 })
  state = tonBalanceReducer(state, { type: 'start', key: tonBalanceKey(B), requestId: 2 })
  assert.deepEqual(state.view, { status: 'loading', previous: null })
  assert.equal(tonBalanceReducer(state, { type: 'success', key: tonBalanceKey(A), requestId: 1, balance: balanceOf(A, 9n) }), state)
  assert.equal(tonBalanceReducer(state, { type: 'failure', key: tonBalanceKey(A), requestId: 1, message: 'old' }), state)
})

test('refresh keeps the last successful balance as previous, also across a failure', () => {
  let state = tonBalanceReducer(initialTonBalanceState, { type: 'start', key: tonBalanceKey(A), requestId: 1 })
  state = tonBalanceReducer(state, { type: 'success', key: tonBalanceKey(A), requestId: 1, balance: balanceOf(A, 7n) })
  state = tonBalanceReducer(state, { type: 'start', key: tonBalanceKey(A), requestId: 2 })
  assert.deepEqual(state.view, { status: 'loading', previous: balanceOf(A, 7n) })
  state = tonBalanceReducer(state, { type: 'failure', key: tonBalanceKey(A), requestId: 2, message: 'down' })
  assert.deepEqual(state.view, { status: 'error', message: 'down', previous: balanceOf(A, 7n) })
  state = tonBalanceReducer(state, { type: 'start', key: tonBalanceKey(A), requestId: 3 })
  assert.deepEqual(state.view, { status: 'loading', previous: balanceOf(A, 7n) })
})

test('reset clears everything and selectTonBalanceView hides data from other keys', () => {
  let state = tonBalanceReducer(initialTonBalanceState, { type: 'start', key: tonBalanceKey(A), requestId: 1 })
  state = tonBalanceReducer(state, { type: 'success', key: tonBalanceKey(A), requestId: 1, balance: balanceOf(A, 7n) })
  assert.equal(selectTonBalanceView(state, tonBalanceKey(A)).status, 'ready')
  assert.deepEqual(selectTonBalanceView(state, tonBalanceKey(B)), { status: 'loading', previous: null })
  assert.deepEqual(selectTonBalanceView(state, null), { status: 'idle' })
  assert.equal(tonBalanceReducer(state, { type: 'reset' }), initialTonBalanceState)
})
