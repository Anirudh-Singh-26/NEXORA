import assert from 'node:assert/strict'
import { test } from 'node:test'
import { INITIAL_ACTIVE_WALLET_STATE, planActiveWallet, type ActiveWalletState, type ObservedStatuses, type WalletEcoId } from './active-wallet.ts'

const idle: ObservedStatuses = { evm: 'disconnected', solana: 'disconnected', ton: 'disconnected', tron: 'disconnected' }
const only = (id: WalletEcoId): ObservedStatuses => ({ ...idle, [id]: 'connected' })
const settled = (statuses: ObservedStatuses, active: WalletEcoId | null): ActiveWalletState => ({ active, statuses })

test('nothing connected: nothing to disconnect', () => {
  const plan = planActiveWallet(INITIAL_ACTIVE_WALLET_STATE, idle)
  assert.deepEqual(plan.disconnect, [])
  assert.equal(plan.state.active, null)
})

test('a rejected/failed connect never changes status, so the previous wallet is preserved', () => {
  const prev = settled(only('evm'), 'evm')
  // TRON went disconnected -> (connecting, which the coordinator reports as disconnected) -> disconnected again.
  const plan = planActiveWallet(prev, only('evm'))
  assert.deepEqual(plan.disconnect, [])
  assert.equal(plan.state.active, 'evm')
})

test('a freshly authorized wallet becomes active and every other connected ecosystem is disconnected', () => {
  const ecosystems: WalletEcoId[] = ['evm', 'solana', 'ton', 'tron']
  for (const from of ecosystems) {
    for (const to of ecosystems.filter((id) => id !== from)) {
      const plan = planActiveWallet(settled(only(from), from), { ...only(from), [to]: 'connected' })
      assert.equal(plan.state.active, to, `${from} -> ${to}`)
      assert.deepEqual(plan.disconnect, [from], `${from} -> ${to}`)
    }
  }
})

test('after the previous wallet is gone the new one stays active with nothing to disconnect', () => {
  const plan = planActiveWallet(settled({ ...only('solana'), evm: 'connected' }, 'solana'), only('solana'))
  assert.deepEqual(plan.disconnect, [])
  assert.equal(plan.state.active, 'solana')
})

test('a session restored on page load never displaces the active wallet', () => {
  // TRON is active; TON Connect finishes restoring a stored session afterwards.
  const prev = settled({ ...only('tron'), ton: 'restoring' }, 'tron')
  const plan = planActiveWallet(prev, { ...only('tron'), ton: 'connected' })
  assert.equal(plan.state.active, 'tron')
  assert.deepEqual(plan.disconnect, ['ton'])
})

test('wallets connected on first render are restored sessions: the first in fixed order is kept', () => {
  const plan = planActiveWallet(INITIAL_ACTIVE_WALLET_STATE, { evm: 'disconnected', solana: 'connected', ton: 'connected', tron: 'disconnected' })
  assert.equal(plan.state.active, 'solana')
  assert.deepEqual(plan.disconnect, ['ton'])
})

test('a single restored wallet becomes active without disconnecting anything', () => {
  const plan = planActiveWallet(INITIAL_ACTIVE_WALLET_STATE, only('tron'))
  assert.equal(plan.state.active, 'tron')
  assert.deepEqual(plan.disconnect, [])
})

test('repeated planning with unchanged statuses keeps naming the same loser (callers de-duplicate in-flight work)', () => {
  const prev = settled({ ...only('evm'), ton: 'connected' }, 'ton')
  const again = planActiveWallet(prev, { ...only('evm'), ton: 'connected' })
  assert.equal(again.state.active, 'ton')
  assert.deepEqual(again.disconnect, ['evm'])
})

test('disconnecting the active wallet clears the active slot', () => {
  const plan = planActiveWallet(settled(only('ton'), 'ton'), idle)
  assert.equal(plan.state.active, null)
  assert.deepEqual(plan.disconnect, [])
})

test('Ethereum then Solana then Ethereum again alternates correctly', () => {
  let state = INITIAL_ACTIVE_WALLET_STATE
  state = planActiveWallet(state, idle).state
  let plan = planActiveWallet(state, only('evm')); state = plan.state
  assert.deepEqual(plan.disconnect, [])
  plan = planActiveWallet(state, { ...only('evm'), solana: 'connected' }); state = plan.state
  assert.deepEqual(plan.disconnect, ['evm'])
  plan = planActiveWallet(state, only('solana')); state = plan.state
  assert.deepEqual(plan.disconnect, [])
  plan = planActiveWallet(state, { ...only('solana'), evm: 'connected' }); state = plan.state
  assert.equal(state.active, 'evm')
  assert.deepEqual(plan.disconnect, ['solana'])
})
