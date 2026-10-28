import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyFeed, feedReducer, type FeedAction, type FeedState } from './feed-state.ts'

type Row = { id: string }
const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id }))
const run = (actions: Array<FeedAction<Row>>, from: FeedState<Row> = emptyFeed<Row>()) => actions.reduce(feedReducer<Row>, from)
const err = { kind: 'upstream', message: 'x', retryable: true }

test('a late response for a previous account cannot overwrite the current account', () => {
  const state = run([
    { type: 'begin', key: 'evm:1:A' },
    { type: 'begin', key: 'evm:1:B' }, // account switched while A was loading
    { type: 'loaded', key: 'evm:1:A', items: rows('a1'), nextCursor: null }, // A's late answer
  ])
  assert.equal(state.key, 'evm:1:B')
  assert.deepEqual(state.items, [])
  assert.equal(state.loaded, false)
  assert.equal(state.loading, true)
  const done = feedReducer(state, { type: 'loaded', key: 'evm:1:B', items: rows('b1'), nextCursor: '5' })
  assert.deepEqual(done.items, rows('b1'))
})

test('network change starts empty and ignores the old chain’s results and failures', () => {
  const state = run([
    { type: 'begin', key: 'evm:1:A' }, { type: 'loaded', key: 'evm:1:A', items: rows('x'), nextCursor: null },
    { type: 'begin', key: 'evm:8453:A' },
    { type: 'failed', key: 'evm:1:A', error: err },
    { type: 'more-loaded', key: 'evm:1:A', items: rows('y'), nextCursor: null },
  ])
  assert.equal(state.key, 'evm:8453:A')
  assert.deepEqual(state.items, [])
  assert.equal(state.error, null)
})

test('disconnect resets everything and later results are ignored', () => {
  const state = run([
    { type: 'begin', key: 'solana:S' }, { type: 'loaded', key: 'solana:S', items: rows('s1'), nextCursor: 'c' },
    { type: 'reset' },
    { type: 'loaded', key: 'solana:S', items: rows('late'), nextCursor: null },
    { type: 'more-loaded', key: 'solana:S', items: rows('late2'), nextCursor: null },
  ])
  assert.deepEqual(state, emptyFeed<Row>())
})

test('refresh of the same key keeps rows visible; failure keeps them and flags the error', () => {
  const loaded = run([{ type: 'begin', key: 'k' }, { type: 'loaded', key: 'k', items: rows('1', '2'), nextCursor: null }])
  const refreshing = feedReducer(loaded, { type: 'begin', key: 'k' })
  assert.equal(refreshing.loading, true)
  assert.deepEqual(refreshing.items, rows('1', '2'))
  const failed = feedReducer(refreshing, { type: 'failed', key: 'k', error: err })
  assert.deepEqual(failed.items, rows('1', '2'))
  assert.deepEqual(failed.error, err)
  assert.equal(failed.loading, false)
})

test('pagination appends without duplicates; a load-more failure keeps page one and is retryable', () => {
  let state = run([{ type: 'begin', key: 'k' }, { type: 'loaded', key: 'k', items: rows('1', '2'), nextCursor: 'c1' }])
  state = run([{ type: 'more-begin', key: 'k' }, { type: 'more-failed', key: 'k', error: err }], state)
  assert.deepEqual(state.items, rows('1', '2'))
  assert.deepEqual(state.moreError, err)
  assert.equal(state.nextCursor, 'c1')
  assert.equal(state.error, null)
  state = run([{ type: 'more-begin', key: 'k' }, { type: 'more-loaded', key: 'k', items: rows('2', '3'), nextCursor: null }], state)
  assert.deepEqual(state.items, rows('1', '2', '3'))
  assert.equal(state.nextCursor, null)
  assert.equal(state.moreError, null)
  assert.equal(state.loadingMore, false)
})
