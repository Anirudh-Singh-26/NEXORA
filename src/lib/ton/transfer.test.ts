import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseTonAmount,
  buildTonTransferRequest,
  checkTonAffordability,
  classifyTonTransferError,
  evaluateTonTransferGate,
  submitTonTransfer,
  TON_TRANSFER_MAX_NANO,
  validateTonRecipient,
} from './transfer.ts'
import { tonTransferFlowReducer, initialTonTransferFlow } from './transfer-flow.ts'


test('parses exact decimal TON without floating point', () => {
  assert.deepEqual(parseTonAmount('0.1'), { ok: true, nano: 100_000_000n })
  assert.deepEqual(parseTonAmount('0.3'), { ok: true, nano: 300_000_000n })
  assert.deepEqual(parseTonAmount('1.000000001'), { ok: true, nano: 1_000_000_001n })
})
test('rejects invalid, zero, excessive precision and over-cap amounts', () => {
  for (const v of ['', '0', '-1', '+1', '1e2', '1,000', '.5', '1.', '0.0000000001', '1001']) assert.equal(parseTonAmount(v).ok, false, v)
  assert.equal(parseTonAmount('1000').ok, true)
  assert.equal(parseTonAmount('1000.000000001').ok, false)
})
test('builds one native transfer explicitly on TON testnet', () => {
  const req = buildTonTransferRequest('0Qrecipient', 500_000_000n, 1_000_000)
  assert.equal(req.network, '-3')
  assert.equal(req.validUntil, 1300)
  assert.deepEqual(req.messages, [{ address: '0Qrecipient', amount: '500000000' }])
  assert.equal(req.messages.length, 1)
  assert.equal(TON_TRANSFER_MAX_NANO, 1_000_000_000_000n)
})
test('known balance check includes fee reserve', () => {
  assert.equal(checkTonAffordability(100_000_000n, null), null)
  assert.match(checkTonAffordability(980_000_000n, 1_000_000_000n) ?? '', /fee/i)
  assert.match(checkTonAffordability(1_100_000_000n, 1_000_000_000n) ?? '', /more than/i)
})
test('validates and rejects malformed recipient addresses', () => {
  assert.equal(validateTonRecipient('').ok, false)
  assert.equal(validateTonRecipient('0:abcd').ok, false)
  assert.equal(validateTonRecipient('not-an-address').ok, false)

  const testnetAddr = '0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATky'
  const mainnetAddr = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYK4'
  const rawAddr = `0:${'0'.repeat(63)}1`

  const validResult = validateTonRecipient(testnetAddr)
  assert.equal(validResult.ok, true)
  if (validResult.ok) assert.equal(validResult.address, testnetAddr)

  const mainnetResult = validateTonRecipient(mainnetAddr)
  assert.equal(mainnetResult.ok, false)
  if (!mainnetResult.ok) assert.equal(mainnetResult.code, 'not-testnet')

  const selfResult = validateTonRecipient(testnetAddr, rawAddr)
  assert.equal(selfResult.ok, false)
  if (!selfResult.ok) assert.equal(selfResult.code, 'self')

  const rawInputResult = validateTonRecipient(rawAddr)
  assert.equal(rawInputResult.ok, false)
  if (!rawInputResult.ok) assert.equal(rawInputResult.code, 'raw-form')
})
test('transfer helper reports wallet acceptance without claiming confirmation', async () => {
  assert.deepEqual(await submitTonTransfer(async () => ({ boc: 'ignored' }), buildTonTransferRequest('recipient', 1n, 0)), { status: 'submitted' })
  const rejected = await submitTonTransfer(async () => { throw new Error('UserRejectsError: User rejects the action in the wallet.') }, buildTonTransferRequest('recipient', 1n, 0))
  assert.equal(rejected.status, 'rejected')
})
test('evaluateTonTransferGate enforces testnet-only policy and valid account state', () => {
  const rawAddr = `0:${'ab'.repeat(32)}`

  const allowed = evaluateTonTransferGate({ restored: true, chain: '-3', address: rawAddr })
  assert.equal(allowed.allowed, true)
  if (allowed.allowed) assert.equal(allowed.address, rawAddr)

  const mainnet = evaluateTonTransferGate({ restored: true, chain: '-239', address: rawAddr })
  assert.equal(mainnet.allowed, false)
  if (!mainnet.allowed) assert.equal(mainnet.reason, 'mainnet')

  const unknownNet = evaluateTonTransferGate({ restored: true, chain: '1', address: rawAddr })
  assert.equal(unknownNet.allowed, false)
  if (!unknownNet.allowed) assert.equal(unknownNet.reason, 'unknown-network')

  const disconnected = evaluateTonTransferGate({ restored: true, chain: '-3', address: null })
  assert.equal(disconnected.allowed, false)
  if (!disconnected.allowed) assert.equal(disconnected.reason, 'disconnected')

  const restoring = evaluateTonTransferGate({ restored: false, chain: '-3', address: rawAddr })
  assert.equal(restoring.allowed, false)
  if (!restoring.allowed) assert.equal(restoring.reason, 'restoring')
})
test('classifyTonTransferError maps wallet error messages to failure kinds', () => {
  assert.equal(classifyTonTransferError(new Error('UserRejectsError: User rejects the action')), 'rejected')
  assert.equal(classifyTonTransferError(new Error('User cancelled transaction')), 'rejected')
  assert.equal(classifyTonTransferError(new Error('WrongNetworkError: Chain mismatch')), 'wrong-network')
  assert.equal(classifyTonTransferError(new Error('Wallet not connected')), 'not-connected')
  assert.equal(classifyTonTransferError(new Error('Method unsupported')), 'unsupported')
  assert.equal(classifyTonTransferError(new Error('Request timed out')), 'timeout')
  assert.equal(classifyTonTransferError(new Error('Unknown RPC failure')), 'error')
})

test('flow reducer transitions through baseline phases to confirming and back to editing', () => {
  const reviewing  = tonTransferFlowReducer(initialTonTransferFlow, { type: 'review', review: { recipient: 'r', amountNano: 1n } })
  assert.equal(reviewing.phase, 'reviewing')
  const fetching   = tonTransferFlowReducer(reviewing, { type: 'fetch-baseline' })
  assert.equal(fetching.phase, 'baseline-fetching')
  // fetch-baseline from non-reviewing phase is no-op
  assert.equal(tonTransferFlowReducer(fetching, { type: 'fetch-baseline' }), fetching)
  const pending    = tonTransferFlowReducer(fetching, { type: 'baseline-ok', baselineLt: 100n })
  assert.equal(pending.phase, 'pending')
  assert.equal(pending.baselineLt, 100n)
  const confirming = tonTransferFlowReducer(pending, { type: 'start-confirming', senderAddress: '0:ab', tracked: null })
  assert.equal(confirming.phase, 'confirming')
  assert.ok(confirming.retryContext !== null)
  const done = tonTransferFlowReducer(confirming, { type: 'confirmation', result: { status: 'confirmed', lt: '200', hash: 'H==', executionResult: 'success' } })
  assert.equal(done.phase, 'editing')
  assert.equal(done.notice?.tone, 'success')
  assert.equal(done.retryContext, null)

  // Test baseline failure flow and send-without-tracking
  const fail = tonTransferFlowReducer(fetching, { type: 'baseline-fail', message: 'Network down' })
  assert.equal(fail.phase, 'baseline-failed')
  assert.equal(fail.baselineFailureMessage, 'Network down')
  const withoutTracking = tonTransferFlowReducer(fail, { type: 'send-without-tracking' })
  assert.equal(withoutTracking.phase, 'pending')
  assert.equal(withoutTracking.baselineLt, null)
  const submitted = tonTransferFlowReducer(withoutTracking, { type: 'outcome', outcome: { status: 'submitted' } })
  assert.equal(submitted.phase, 'editing')
  assert.match(submitted.notice?.message ?? '', /Automatic confirmation tracking was unavailable/)

  // Test abort, back and dismiss
  const rev2 = tonTransferFlowReducer(initialTonTransferFlow, { type: 'review', review: { recipient: 'r', amountNano: 1n } })
  const backed = tonTransferFlowReducer(rev2, { type: 'back' })
  assert.equal(backed.phase, 'editing')
  const rev3 = tonTransferFlowReducer(initialTonTransferFlow, { type: 'review', review: { recipient: 'r', amountNano: 1n } })
  const aborted = tonTransferFlowReducer(rev3, { type: 'abort', message: 'Aborted due to disconnect' })
  assert.equal(aborted.phase, 'editing')
  assert.equal(aborted.notice?.tone, 'error')
  const dismissed = tonTransferFlowReducer(aborted, { type: 'dismiss' })
  assert.equal(dismissed.notice, null)
})
