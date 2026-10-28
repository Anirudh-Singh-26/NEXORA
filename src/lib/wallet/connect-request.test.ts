import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyConnectError, connectRequestReducer, IDLE_CONNECT_REQUEST, type ConnectRequestState } from './connect-request.ts'

const run = (actions: Parameters<typeof connectRequestReducer>[1][]): ConnectRequestState =>
  actions.reduce(connectRequestReducer, IDLE_CONNECT_REQUEST)

test('a request is pending after begin and cleared when it settles', () => {
  assert.equal(run([{ type: 'begin', id: 1 }]).current, 1)
  assert.equal(run([{ type: 'begin', id: 1 }, { type: 'settle', id: 1 }]).current, null)
})

test('closing/cancelling the modal clears the pending request and allows a retry', () => {
  const closed = run([{ type: 'begin', id: 1 }, { type: 'close' }])
  assert.equal(closed.current, null)
  assert.equal(connectRequestReducer(closed, { type: 'begin', id: 2 }).current, 2)
})

test('a stale request cannot clear or fail a newer request', () => {
  const state = run([{ type: 'begin', id: 1 }, { type: 'begin', id: 2 }, { type: 'settle', id: 1 }])
  assert.equal(state.current, 2)
  const afterClose = run([{ type: 'begin', id: 1 }, { type: 'close' }, { type: 'begin', id: 2 }, { type: 'settle', id: 1 }])
  assert.equal(afterClose.current, 2)
})

test('close on an idle state keeps the same state object', () => {
  assert.equal(connectRequestReducer(IDLE_CONNECT_REQUEST, { type: 'close' }), IDLE_CONNECT_REQUEST)
})

test('classifyConnectError distinguishes rejection, configuration, unavailable and other failures', () => {
  assert.equal(classifyConnectError({ code: 4001, message: 'User rejected the request.' }).kind, 'rejected')
  assert.equal(classifyConnectError(new Error('Request cancelled by user')).kind, 'rejected')
  assert.equal(classifyConnectError('Origin not allowed').kind, 'configuration')
  assert.equal(classifyConnectError(new Error('Invalid project id')).kind, 'configuration')
  assert.equal(classifyConnectError(new Error('Wallet not installed')).kind, 'unavailable')
  assert.equal(classifyConnectError(new Error('socket hang up')).kind, 'other')
  assert.equal(classifyConnectError(undefined).kind, 'other')
})
