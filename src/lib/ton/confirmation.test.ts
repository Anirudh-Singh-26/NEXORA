import assert from 'node:assert/strict'
import test from 'node:test'
import { Address, beginCell } from '@ton/core'
import {
  classifyExecution,
  extractBodyHash,
  fetchBaselineLt,
  fetchRecentTransactions,
  findMatchingTx,
  parseBaselineLt,
  TonConfirmationError,
  tonTxExplorerUrl,
} from './confirmation.ts'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const RAW_ADDR = `0:${'ab'.repeat(32)}`
const DEST     = Address.parseRaw(RAW_ADDR)
const RECIPIENT = DEST.toString({ urlSafe: true, bounceable: false, testOnly: true })
const AMOUNT   = 500_000_000n

// Build a minimal external-in message with body as reference (per TL-B spec)
const TEST_BODY = beginCell().storeUint(42, 32).endCell()
const TEST_MSG_CELL = beginCell()
  .storeUint(0b10, 2)   // ext_in_msg_info tag
  .storeUint(0, 2)      // addr_none src
  .storeAddress(DEST)
  .storeCoins(0n)       // import_fee
  .storeBit(0)          // no StateInit
  .storeBit(1)          // body as ref
  .storeRef(TEST_BODY)
  .endCell()
const TEST_BOC       = TEST_MSG_CELL.toBoc().toString('base64')
const BODY_HASH_HEX  = [...TEST_BODY.hash()].map((b) => b.toString(16).padStart(2, '0')).join('')
const BODY_HASH_B64  = Buffer.from(BODY_HASH_HEX, 'hex').toString('base64')

function respond(status: number, body: unknown, raw = false): typeof fetch {
  return (async () => new Response(raw ? String(body) : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch
}

// ─── tonTxExplorerUrl ────────────────────────────────────────────────────────

test('tonTxExplorerUrl builds testnet.tonviewer.com/transaction URL', () => {
  assert.equal(tonTxExplorerUrl('HASH=='), 'https://testnet.tonviewer.com/transaction/HASH%3D%3D')
  assert.equal(tonTxExplorerUrl('abc123'), 'https://testnet.tonviewer.com/transaction/abc123')
})

// ─── parseBaselineLt ─────────────────────────────────────────────────────────

test('parseBaselineLt parses valid decimal string to bigint', () => {
  assert.equal(parseBaselineLt('43210987000003'), 43210987000003n)
  assert.equal(parseBaselineLt('0'), 0n)
})
test('parseBaselineLt throws on non-decimal or oversized input', () => {
  for (const v of ['', '-1', '1.5', '1e9', 'abc', '1'.repeat(31), 5, null, undefined]) {
    assert.throws(() => parseBaselineLt(v), TonConfirmationError, String(v))
  }
})

// ─── extractBodyHash ─────────────────────────────────────────────────────────

test('extractBodyHash returns lowercase hex body hash for a valid external-in BOC', () => {
  const hash = extractBodyHash(TEST_BOC)
  assert.equal(hash, BODY_HASH_HEX)
  assert.match(hash!, /^[0-9a-f]{64}$/)
})
test('extractBodyHash returns null for invalid or non-message input', () => {
  assert.equal(extractBodyHash(''), null)
  assert.equal(extractBodyHash('notvalidbase64!!!!'), null)
  assert.equal(extractBodyHash('dGVzdA=='), null) // valid base64, not a message
})

// ─── classifyExecution ───────────────────────────────────────────────────────

test('classifyExecution returns success when both phases report true', () => {
  assert.equal(classifyExecution({ compute_ph: { success: true }, action_ph: { success: true } }), 'success')
})
test('classifyExecution returns failed when compute_ph is false', () => {
  assert.equal(classifyExecution({ compute_ph: { success: false }, action_ph: { success: true } }), 'failed')
})
test('classifyExecution returns failed when action_ph is false', () => {
  assert.equal(classifyExecution({ compute_ph: { success: true }, action_ph: { success: false } }), 'failed')
})
test('classifyExecution returns unknown when compute_ph is missing', () => {
  assert.equal(classifyExecution({ action_ph: { success: true } }), 'unknown')
})
test('classifyExecution returns unknown when action_ph is missing', () => {
  assert.equal(classifyExecution({ compute_ph: { success: true } }), 'unknown')
})
test('classifyExecution returns unknown for null description', () => {
  assert.equal(classifyExecution(null), 'unknown')
  assert.equal(classifyExecution(undefined), 'unknown')
  assert.equal(classifyExecution({}), 'unknown')
})
test('classifyExecution returns unknown when success is not a boolean', () => {
  assert.equal(classifyExecution({ compute_ph: { success: 1 }, action_ph: { success: true } }), 'unknown')
  assert.equal(classifyExecution({ compute_ph: { success: null }, action_ph: { success: true } }), 'unknown')
})

// ─── findMatchingTx — body-hash primary ──────────────────────────────────────

test('findMatchingTx matches by body hash (primary correlation)', () => {
  const results = [{
    transaction_id: { lt: '2000', hash: 'txhash1==' },
    in_msg: { source: '', body_hash: BODY_HASH_B64 },
    description: { compute_ph: { success: true }, action_ph: { success: true } },
  }]
  const m = findMatchingTx(results, 1000n, RECIPIENT, AMOUNT, BODY_HASH_HEX)
  assert.equal(m.found, true)
  if (m.found) { assert.equal(m.lt, '2000'); assert.equal(m.executionResult, 'success') }
})

test('findMatchingTx matches body hash in hex format', () => {
  const results = [{
    transaction_id: { lt: '2000', hash: 'txhash2==' },
    in_msg: { source: '', body_hash: BODY_HASH_HEX.toUpperCase() },
    description: { compute_ph: { success: true }, action_ph: { success: true } },
  }]
  const m = findMatchingTx(results, 1000n, RECIPIENT, AMOUNT, BODY_HASH_HEX)
  assert.equal(m.found, true)
})

test('findMatchingTx skips transaction with wrong body hash', () => {
  const results = [{
    transaction_id: { lt: '2000', hash: 'txhash1==' },
    in_msg: { source: '', body_hash: 'wronghash==' },
    description: { compute_ph: { success: true }, action_ph: { success: true } },
  }]
  const m = findMatchingTx(results, 1000n, RECIPIENT, AMOUNT, BODY_HASH_HEX)
  assert.equal(m.found, false)
  if (!m.found) assert.equal(m.ambiguous, false)
})

// ─── findMatchingTx — heuristic fallback ─────────────────────────────────────

test('findMatchingTx finds matching tx via fallback heuristic', () => {
  const results = [{
    transaction_id: { lt: '2000', hash: 'txhash1==' },
    in_msg: { source: '' },
    out_msgs: [{ destination: RECIPIENT, value: AMOUNT.toString() }],
    description: { compute_ph: { success: true }, action_ph: { success: true } },
  }]
  const m = findMatchingTx(results, 1000n, RECIPIENT, AMOUNT, null)
  assert.equal(m.found, true)
  if (m.found) assert.equal(m.executionResult, 'success')
})

test('findMatchingTx skips tx with lt <= baselineLt', () => {
  const results = [{
    transaction_id: { lt: '1000', hash: 'txhash==' },
    in_msg: { source: '' },
    out_msgs: [{ destination: RECIPIENT, value: AMOUNT.toString() }],
    description: { compute_ph: { success: true }, action_ph: { success: true } },
  }]
  const m = findMatchingTx(results, 1000n, RECIPIENT, AMOUNT, null)
  assert.equal(m.found, false)
})

test('findMatchingTx skips non-external-in transactions in fallback mode', () => {
  const results = [{
    transaction_id: { lt: '2000', hash: 'txhash==' },
    in_msg: { source: 'EQsomeothercontract' },
    out_msgs: [{ destination: RECIPIENT, value: AMOUNT.toString() }],
    description: { compute_ph: { success: true }, action_ph: { success: true } },
  }]
  const m = findMatchingTx(results, 1000n, RECIPIENT, AMOUNT, null)
  assert.equal(m.found, false)
})

test('findMatchingTx skips tx with wrong recipient in fallback mode', () => {
  const other = Address.parseRaw(`0:${'cd'.repeat(32)}`).toString({ urlSafe: true, bounceable: false, testOnly: true })
  const results = [{
    transaction_id: { lt: '2000', hash: 'txhash==' },
    in_msg: { source: '' },
    out_msgs: [{ destination: other, value: AMOUNT.toString() }],
    description: { compute_ph: { success: true }, action_ph: { success: true } },
  }]
  const m = findMatchingTx(results, 1000n, RECIPIENT, AMOUNT, null)
  assert.equal(m.found, false)
})

test('findMatchingTx skips tx with wrong amount in fallback mode', () => {
  const results = [{
    transaction_id: { lt: '2000', hash: 'txhash==' },
    in_msg: { source: '' },
    out_msgs: [{ destination: RECIPIENT, value: '999' }],
    description: { compute_ph: { success: true }, action_ph: { success: true } },
  }]
  const m = findMatchingTx(results, 1000n, RECIPIENT, AMOUNT, null)
  assert.equal(m.found, false)
})

test('findMatchingTx returns not-found for empty results', () => {
  const m = findMatchingTx([], 1000n, RECIPIENT, AMOUNT, null)
  assert.equal(m.found, false)
  if (!m.found) assert.equal(m.ambiguous, false)
})

test('findMatchingTx returns ambiguous when 2 candidates match in fallback mode', () => {
  const tx = {
    in_msg: { source: '' },
    out_msgs: [{ destination: RECIPIENT, value: AMOUNT.toString() }],
    description: { compute_ph: { success: true }, action_ph: { success: true } },
  }
  const results = [
    { ...tx, transaction_id: { lt: '2000', hash: 'hash1==' } },
    { ...tx, transaction_id: { lt: '3000', hash: 'hash2==' } },
  ]
  const m = findMatchingTx(results, 1000n, RECIPIENT, AMOUNT, null)
  assert.equal(m.found, false)
  if (!m.found) assert.equal(m.ambiguous, true)
})

test('findMatchingTx uses classifyExecution to determine execution result', () => {
  const results = [{
    transaction_id: { lt: '2000', hash: 'txhash==' },
    in_msg: { source: '' },
    out_msgs: [{ destination: RECIPIENT, value: AMOUNT.toString() }],
    description: { compute_ph: { success: false }, action_ph: { success: true } },
  }]
  const m = findMatchingTx(results, 1000n, RECIPIENT, AMOUNT, null)
  assert.equal(m.found, true)
  if (m.found) assert.equal(m.executionResult, 'failed')
})

test('findMatchingTx treats missing description phases as execution-unknown', () => {
  const results = [{
    transaction_id: { lt: '2000', hash: 'txhash==' },
    in_msg: { source: '' },
    out_msgs: [{ destination: RECIPIENT, value: AMOUNT.toString() }],
    description: { compute_ph: { success: true } }, // action_ph missing
  }]
  const m = findMatchingTx(results, 1000n, RECIPIENT, AMOUNT, null)
  assert.equal(m.found, true)
  if (m.found) assert.equal(m.executionResult, 'unknown')
})

// ─── fetchBaselineLt ─────────────────────────────────────────────────────────

test('fetchBaselineLt returns lt as bigint on success', async () => {
  const fetchImpl = respond(200, { ok: true, result: { last_transaction_id: { lt: '43210987000003', hash: 'H==' } } })
  assert.equal(await fetchBaselineLt(RAW_ADDR, { fetchImpl }), 43210987000003n)
})

test('fetchBaselineLt returns 0n when last_transaction_id is absent', async () => {
  const fetchImpl = respond(200, { ok: true, result: {} })
  assert.equal(await fetchBaselineLt(RAW_ADDR, { fetchImpl }), 0n)
})

test('fetchBaselineLt returns 0n when last_transaction_id is null', async () => {
  const fetchImpl = respond(200, { ok: true, result: { last_transaction_id: null } })
  assert.equal(await fetchBaselineLt(RAW_ADDR, { fetchImpl }), 0n)
})

test('fetchBaselineLt returns 0n when lt is "0"', async () => {
  const fetchImpl = respond(200, { ok: true, result: { last_transaction_id: { lt: '0', hash: 'H==' } } })
  assert.equal(await fetchBaselineLt(RAW_ADDR, { fetchImpl }), 0n)
})

test('fetchBaselineLt throws TonConfirmationError for malformed lt', async () => {
  const fetchImpl = respond(200, { ok: true, result: { last_transaction_id: { lt: 'not-a-number', hash: 'H==' } } })
  await assert.rejects(fetchBaselineLt(RAW_ADDR, { fetchImpl }), TonConfirmationError)
})

test('fetchBaselineLt throws TonConfirmationError for HTTP 429', async () => {
  const fetchImpl = respond(429, { ok: false })
  await assert.rejects(fetchBaselineLt(RAW_ADDR, { fetchImpl }), (e: unknown) => e instanceof TonConfirmationError && e.kind === 'rate-limited')
})

test('fetchBaselineLt throws TonConfirmationError for network error', async () => {
  const fetchImpl = (async () => { throw new TypeError('Failed to fetch') }) as typeof fetch
  await assert.rejects(fetchBaselineLt(RAW_ADDR, { fetchImpl }), (e: unknown) => e instanceof TonConfirmationError && e.kind === 'network')
})

test('fetchBaselineLt rethrows AbortError untouched', async () => {
  const fetchImpl = (async () => { throw new DOMException('aborted', 'AbortError') }) as typeof fetch
  await assert.rejects(fetchBaselineLt(RAW_ADDR, { fetchImpl }), (e: unknown) => e instanceof DOMException && e.name === 'AbortError')
})

// ─── fetchRecentTransactions ──────────────────────────────────────────────────

test('fetchRecentTransactions returns result array on success', async () => {
  const txs = [{ transaction_id: { lt: '1', hash: 'H==' }, in_msg: {}, out_msgs: [] }]
  const fetchImpl = respond(200, { ok: true, result: txs })
  const result = await fetchRecentTransactions(RAW_ADDR, { fetchImpl })
  assert.deepEqual(result, txs)
})

test('fetchRecentTransactions throws when ok is false', async () => {
  const fetchImpl = respond(200, { ok: false })
  await assert.rejects(fetchRecentTransactions(RAW_ADDR, { fetchImpl }), TonConfirmationError)
})

test('fetchRecentTransactions throws when result is not an array', async () => {
  const fetchImpl = respond(200, { ok: true, result: {} })
  await assert.rejects(fetchRecentTransactions(RAW_ADDR, { fetchImpl }), TonConfirmationError)
})

test('fetchRecentTransactions throws on malformed JSON', async () => {
  const fetchImpl = respond(200, '<html>', true)
  await assert.rejects(fetchRecentTransactions(RAW_ADDR, { fetchImpl }), TonConfirmationError)
})

test('fetchRecentTransactions rethrows AbortError', async () => {
  const fetchImpl = (async () => { throw new DOMException('aborted', 'AbortError') }) as typeof fetch
  await assert.rejects(fetchRecentTransactions(RAW_ADDR, { fetchImpl }), (e: unknown) => e instanceof DOMException && e.name === 'AbortError')
})
