import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BoundedCache } from './cache.ts'

test('entries expire at their hard limit', () => {
  const cache = new BoundedCache<number>(4)
  cache.set('a', 1, 1000, 500)
  assert.equal(cache.get('a', 1499)?.value, 1)
  assert.equal(cache.get('a', 1500), undefined)
  assert.equal(cache.size, 0)
})

test('the cache is bounded and evicts least recently used', () => {
  const cache = new BoundedCache<number>(2)
  cache.set('a', 1, 0, 1000)
  cache.set('b', 2, 0, 1000)
  cache.get('a', 1) // touch a, so b is now oldest
  cache.set('c', 3, 2, 1000)
  assert.equal(cache.size, 2)
  assert.equal(cache.get('b', 3), undefined)
  assert.equal(cache.get('a', 3)?.value, 1)
  assert.equal(cache.get('c', 3)?.value, 3)
})
