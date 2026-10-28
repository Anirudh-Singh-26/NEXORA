import assert from 'node:assert/strict'
import test from 'node:test'
import { checkEthAffordability, formatEth, maxSendable, parseEthAmount, validateEthRecipient, WEI_PER_ETH, type EthChainSnapshot } from './amount.ts'
import { classifyEthError, EthTransferError } from './errors.ts'
import { evaluateEthSendGate } from './gate.ts'
import { ethTransferReducer, initialEthTransferState, type EthTransferState } from './flow.ts'
import { submitEthTransfer, type EthSubmitDeps } from './submit.ts'
import { fetchEthSnapshot, type EthReader } from './client.ts'

const OWN = '0x52908400098527886E0F7030069857D2E4169EE7'
const OTHER = '0x8617E340B3D01FA5F11F306F4090FD50E238070D'
const HASH = `0x${'ab'.repeat(32)}` as const
const SEPOLIA = 11155111

test('parseEthAmount: exact wei, no floats, strict format', () => {
  assert.deepEqual(parseEthAmount('1'), { ok: true, wei: WEI_PER_ETH })
  assert.deepEqual(parseEthAmount('0.000000000000000001'), { ok: true, wei: 1n })
  assert.deepEqual(parseEthAmount('.5'), { ok: true, wei: WEI_PER_ETH / 2n })
  assert.deepEqual(parseEthAmount(' 0.1 '), { ok: true, wei: WEI_PER_ETH / 10n })
  for (const bad of ['', '0', '0.0', '-1', '1e3', '1,5', '0x10', '1.2.3', 'abc', '0.0000000000000000001', '99999999999']) assert.equal(parseEthAmount(bad).ok, false, bad)
})

test('formatEth round-trips', () => {
  assert.equal(formatEth(WEI_PER_ETH), '1')
  assert.equal(formatEth(1n), '0.000000000000000001')
  assert.equal(formatEth(1_500_000_000_000_000_000n), '1.5')
  assert.equal(formatEth(0n), '0')
})

test('validateEthRecipient: format, checksum, zero, self, Solana-looking', () => {
  assert.deepEqual(validateEthRecipient(OTHER, OWN), { ok: true, address: OTHER })
  assert.equal(validateEthRecipient(OTHER.toLowerCase(), OWN).ok, true)
  assert.equal(validateEthRecipient('', OWN).ok, false)
  assert.equal(validateEthRecipient('0x123', OWN).ok, false)
  assert.equal(validateEthRecipient(OWN.toLowerCase(), OWN).ok, false)
  assert.equal(validateEthRecipient('0x0000000000000000000000000000000000000000', OWN).ok, false)
  const badChecksum = OTHER.slice(0, -1) + (OTHER.endsWith('D') ? 'd' : 'D')
  assert.equal(validateEthRecipient(badChecksum, OWN).ok, false)
  const sol = validateEthRecipient('EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG', OWN)
  assert.ok(!sol.ok && /Solana/.test(sol.message))
})

const snap: EthChainSnapshot = { balance: 2n * WEI_PER_ETH, gas: 21_000n, maxFeePerGas: 10_000_000_000n }

test('affordability and max sendable account for worst-case fee', () => {
  const fee = 21_000n * 10_000_000_000n
  assert.equal(maxSendable(snap), 2n * WEI_PER_ETH - fee)
  assert.equal(checkEthAffordability(WEI_PER_ETH, snap), null)
  assert.equal(checkEthAffordability(maxSendable(snap)!, snap), null)
  assert.match(checkEthAffordability(maxSendable(snap)! + 1n, snap)!, /Not enough/)
  assert.match(checkEthAffordability(1n, null)!, /not loaded/)
  assert.equal(maxSendable({ ...snap, balance: 1n }), 0n)
})

test('gate: only a connected Sepolia account passes', () => {
  assert.deepEqual(evaluateEthSendGate({ address: OWN, chainId: SEPOLIA }), { allowed: true, address: OWN, chainId: SEPOLIA })
  assert.equal(evaluateEthSendGate({ address: null, chainId: SEPOLIA }).allowed, false)
  assert.equal(evaluateEthSendGate({ address: OWN, chainId: null }).allowed, false)
  assert.equal(evaluateEthSendGate({ address: OWN, chainId: 1 }).allowed, false)
  assert.equal(evaluateEthSendGate({ address: OWN, chainId: 8453 }).allowed, false)
  assert.equal(evaluateEthSendGate({ address: OWN, chainId: SEPOLIA, restoring: true }).allowed, false)
  assert.equal(evaluateEthSendGate({ address: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG', chainId: SEPOLIA }).allowed, false)
})

test('classifyEthError maps wallet / wagmi errors without leaking raw text', () => {
  assert.equal(classifyEthError({ code: 4001, message: 'x' }).kind, 'user-rejected')
  assert.equal(classifyEthError({ name: 'UserRejectedRequestError', message: 'User rejected the request.' }).kind, 'user-rejected')
  assert.equal(classifyEthError({ message: 'wrapped', cause: { code: 4001 } }).kind, 'user-rejected')
  assert.equal(classifyEthError({ name: 'ConnectorChainMismatchError' }).kind, 'network-mismatch')
  assert.equal(classifyEthError({ shortMessage: 'The total cost exceeds the balance of the account. insufficient funds' }).kind, 'insufficient-funds')
  assert.equal(classifyEthError({ name: 'ConnectorNotConnectedError' }).kind, 'wallet-unavailable')
  assert.equal(classifyEthError(new EthTransferError('rpc-failure')).kind, 'rpc-failure')
  const unknown = classifyEthError(new Error('https://secret.example/key123'))
  assert.equal(unknown.kind, 'unknown')
  assert.ok(!unknown.message.includes('secret'))
})

function deps(over: Partial<EthSubmitDeps> = {}, calls: string[] = []): EthSubmitDeps {
  return {
    gateMessage: () => null,
    snapshot: async () => { calls.push('snapshot'); return snap },
    send: async () => { calls.push('send'); return HASH },
    ...over,
  }
}
const intent = { from: OWN as `0x${string}`, to: OTHER as `0x${string}`, wei: WEI_PER_ETH }

test('submit: happy path returns the wallet hash and the fee ceiling', async () => {
  const calls: string[] = []
  const out = await submitEthTransfer(deps({}, calls), intent)
  assert.equal(out.status, 'submitted')
  assert.deepEqual(calls, ['snapshot', 'send'])
  if (out.status === 'submitted') { assert.equal(out.hash, HASH); assert.equal(out.maxFeeWei, 21_000n * 10_000_000_000n) }
})

test('submit: closed gate (before or just before wallet) never reaches the wallet', async () => {
  const calls: string[] = []
  assert.equal((await submitEthTransfer(deps({ gateMessage: () => 'Switch to Sepolia.' }, calls), intent)).status, 'blocked')
  let n = 0
  const late = await submitEthTransfer(deps({ gateMessage: () => (n++ === 0 ? null : 'Network changed.') }, calls), intent)
  assert.equal(late.status, 'blocked')
  assert.ok(!calls.includes('send'))
})

test('submit: unaffordable amount is blocked before the wallet', async () => {
  const calls: string[] = []
  const out = await submitEthTransfer(deps({}, calls), { ...intent, wei: 3n * WEI_PER_ETH })
  assert.equal(out.status, 'blocked')
  assert.ok(!calls.includes('send'))
})

test('submit: wallet rejection is classified, not a success', async () => {
  const out = await submitEthTransfer(deps({ send: async () => { throw { code: 4001 } } }), intent)
  assert.equal(out.status, 'failed')
  if (out.status === 'failed') { assert.equal(out.failure.kind, 'user-rejected'); assert.equal(out.possiblySent, false) }
})

test('submit: a malformed hash from the wallet is never treated as success', async () => {
  for (const bad of ['0x123', 'nope', '', undefined, 42]) {
    const out = await submitEthTransfer(deps({ send: async () => bad as unknown as string }), intent)
    assert.equal(out.status, 'failed')
  }
})

test('submit: snapshot failure stops before the wallet', async () => {
  const out = await submitEthTransfer(deps({ snapshot: async () => { throw new EthTransferError('rpc-failure') } }), intent)
  assert.equal(out.status, 'failed')
})

function sending(): EthTransferState {
  let s = ethTransferReducer(initialEthTransferState, { type: 'review', review: { recipient: OTHER as `0x${string}`, wei: 1n, maxFeeWei: 2n } })
  s = ethTransferReducer(s, { type: 'send' })
  return s
}

test('flow: duplicate send ignored; submitted -> confirming; success only after receipt', () => {
  const s = sending()
  assert.equal(s.phase, 'sending')
  assert.equal(ethTransferReducer(s, { type: 'send' }), s)
  const c = ethTransferReducer(s, { type: 'outcome', outcome: { status: 'submitted', hash: HASH, maxFeeWei: 2n } })
  assert.equal(c.phase, 'confirming')
  assert.equal(c.notice, null) // no success message at submission time
  assert.equal(ethTransferReducer(c, { type: 'poll', state: 'pending' }), c)
  const done = ethTransferReducer(c, { type: 'poll', state: 'success' })
  assert.equal(done.notice?.tone, 'success')
  assert.match(done.notice!.explorerUrl!, /sepolia\.etherscan\.io\/tx\/0xab/)
  const reverted = ethTransferReducer(c, { type: 'poll', state: 'reverted' })
  assert.equal(reverted.notice?.tone, 'error')
  const timeout = ethTransferReducer(c, { type: 'poll-timeout' })
  assert.equal(timeout.notice?.tone, 'info')
  assert.equal(ethTransferReducer(timeout, { type: 'resume-confirming' }).phase, 'confirming')
})

test('flow: failed / blocked outcomes return to editing with an error notice and no submission', () => {
  const failed = ethTransferReducer(sending(), { type: 'outcome', outcome: { status: 'failed', failure: { kind: 'user-rejected', message: 'declined' }, possiblySent: false } })
  assert.equal(failed.phase, 'editing'); assert.equal(failed.submitted, null); assert.equal(failed.notice?.tone, 'info')
  const blocked = ethTransferReducer(sending(), { type: 'outcome', outcome: { status: 'blocked', message: 'no' } })
  assert.equal(blocked.notice?.tone, 'error')
})

function reader(over: Partial<EthReader> = {}): EthReader {
  return {
    getBalance: async () => 5n * WEI_PER_ETH, estimateGas: async () => 21_000n, maxFeePerGas: async () => 7n, receiptState: async () => 'pending', chainId: async () => SEPOLIA, ...over,
  }
}

test('fetchEthSnapshot: refuses a non-Sepolia answer and surfaces estimation failures', async () => {
  const ok = await fetchEthSnapshot(reader(), OWN as `0x${string}`, OTHER as `0x${string}`, 1n)
  assert.deepEqual(ok, { balance: 5n * WEI_PER_ETH, gas: 21_000n, maxFeePerGas: 7n })
  await assert.rejects(fetchEthSnapshot(reader({ chainId: async () => 1 }), OWN as `0x${string}`, null, 0n), (e: unknown) => (e as EthTransferError).kind === 'network-mismatch')
  await assert.rejects(fetchEthSnapshot(reader({ estimateGas: async () => { throw Object.assign(new Error('execution reverted'), { name: 'EstimateGasExecutionError' }) } }), OWN as `0x${string}`, OTHER as `0x${string}`, 1n), (e: unknown) => (e as EthTransferError).kind === 'gas-estimation')
  await assert.rejects(fetchEthSnapshot(reader({ getBalance: async () => { throw new Error('boom') } }), OWN as `0x${string}`, null, 0n), (e: unknown) => (e as EthTransferError).kind === 'rpc-failure')
})
