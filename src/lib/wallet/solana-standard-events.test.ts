import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyStandardChange, createSolanaChangeListener, getStandardEvents, resolveSolanaAddress } from './solana-standard-events.ts'

test('empty accounts array is an external disconnect', () => {
  assert.deepEqual(classifyStandardChange({ accounts: [] }), { kind: 'disconnected' })
})

test('first account is the active one', () => {
  assert.deepEqual(classifyStandardChange({ accounts: [{ address: 'B' }, { address: 'C' }] }), { kind: 'account', address: 'B' })
})

test('changes without an accounts list are ignored', () => {
  assert.deepEqual(classifyStandardChange({ chains: ['solana:mainnet'] }), { kind: 'ignore' })
  assert.deepEqual(classifyStandardChange(undefined), { kind: 'ignore' })
  assert.deepEqual(classifyStandardChange({ accounts: 'nope' }), { kind: 'ignore' })
  assert.deepEqual(classifyStandardChange({ accounts: [{}] }), { kind: 'ignore' })
})

test('getStandardEvents only accepts providers wrapping a wallet with standard:events.on', () => {
  const on = () => () => undefined
  assert.equal(getStandardEvents({ wallet: { features: { 'standard:events': { on } } } })?.on, on)
  assert.equal(getStandardEvents({ wallet: { features: {} } }), null)
  assert.equal(getStandardEvents({ wallet: { features: { 'standard:events': {} } } }), null)
  assert.equal(getStandardEvents({}), null)
  assert.equal(getStandardEvents(undefined), null)
})

test('override applies only while AppKit still shows the address it was based on', () => {
  assert.equal(resolveSolanaAddress('A', { base: 'A', address: 'B' }), 'B')
  assert.equal(resolveSolanaAddress('C', { base: 'A', address: 'B' }), 'C')
  assert.equal(resolveSolanaAddress('A', null), 'A')
  assert.equal(resolveSolanaAddress(null, { base: 'A', address: 'B' }), null)
})

function harness(inApp = false) {
  const calls = { accounts: [] as string[], disconnects: 0, errors: 0 }
  let state = { inApp }
  let resolve: () => void = () => undefined
  let reject: () => void = () => undefined
  const subscription = createSolanaChangeListener({
    isInAppDisconnect: () => state.inApp,
    onAccount: (address) => calls.accounts.push(address),
    disconnect: () => { calls.disconnects += 1; return new Promise<void>((res, rej) => { resolve = res; reject = () => rej(new Error('x')) }) },
    onDisconnectError: () => { calls.errors += 1 },
  })
  return { calls, subscription, setInApp: (value: boolean) => { state = { inApp: value } }, resolve: () => resolve(), reject: () => reject() }
}
const tick = () => new Promise((done) => setTimeout(done, 0))

test('external disconnect requests exactly one Solana disconnect, even for repeated events', () => {
  const h = harness()
  h.subscription.listener({ accounts: [] })
  h.subscription.listener({ accounts: [] })
  assert.equal(h.calls.disconnects, 1)
})

test('a failed disconnect is reported and re-arms the listener', async () => {
  const h = harness()
  h.subscription.listener({ accounts: [] })
  h.reject()
  await tick()
  assert.equal(h.calls.errors, 1)
  h.subscription.listener({ accounts: [] })
  assert.equal(h.calls.disconnects, 2)
})

test('events echoed during NEXORA\'s own disconnect are ignored', () => {
  const h = harness(true)
  h.subscription.listener({ accounts: [] })
  h.subscription.listener({ accounts: [{ address: 'B' }] })
  assert.equal(h.calls.disconnects, 0)
  assert.deepEqual(h.calls.accounts, [])
  h.setInApp(false)
  h.subscription.listener({ accounts: [] })
  assert.equal(h.calls.disconnects, 1)
})

test('account switches are forwarded, in order, without disconnecting', () => {
  const h = harness()
  h.subscription.listener({ accounts: [{ address: 'B' }] })
  h.subscription.listener({ accounts: [{ address: 'C' }] })
  h.subscription.listener({ chains: [] })
  assert.deepEqual(h.calls.accounts, ['B', 'C'])
  assert.equal(h.calls.disconnects, 0)
})

test('after dispose, late events from the old subscription do nothing', async () => {
  const h = harness()
  h.subscription.dispose()
  h.subscription.listener({ accounts: [] })
  h.subscription.listener({ accounts: [{ address: 'B' }] })
  assert.equal(h.calls.disconnects, 0)
  assert.deepEqual(h.calls.accounts, [])
  const g = harness()
  g.subscription.listener({ accounts: [] })
  g.subscription.dispose()
  g.reject()
  await tick()
  assert.equal(g.calls.errors, 0)
})
