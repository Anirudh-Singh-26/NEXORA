import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseProjectId } from './project-id.ts'

test('parseProjectId accepts UUID-style hyphenated and plain alphanumeric IDs, trimming whitespace', () => {
  assert.equal(parseProjectId('123e4567-e89b-12d3-a456-426614174000'), '123e4567-e89b-12d3-a456-426614174000')
  assert.equal(parseProjectId('0123456789abcdef0123456789abcdef'), '0123456789abcdef0123456789abcdef')
  assert.equal(parseProjectId('  123e4567-e89b-12d3-a456-426614174000\n'), '123e4567-e89b-12d3-a456-426614174000')
})

test('parseProjectId rejects missing, empty and malformed values', () => {
  for (const bad of [undefined, null, 42, '', '   ', 'short', 'abc-123', '-leading-hyphen-1234', 'trailing-hyphen-1234-',
    'has space inside-1234', 'quote"d-id-12345678', 'under_score_12345678', 'ünïcode-id-12345678', 'x'.repeat(129)]) {
    assert.equal(parseProjectId(bad), null, `should reject ${JSON.stringify(bad)}`)
  }
})
