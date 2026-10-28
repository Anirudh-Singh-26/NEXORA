import assert from 'node:assert/strict'
import test from 'node:test'
import { checkAffordability, maxSendable, parseSolAmount, validateSolRecipient, LAMPORTS_PER_SOL, SYSTEM_PROGRAM_ADDRESS } from './amount.ts'
import { classifyTransferError, TransferError } from './errors.ts'
import { evaluateSolSendGate } from './gate.ts'
import { initialSolTransferState, solTransferReducer, type SolTransferState } from './flow.ts'
import { submitSolTransfer, type SubmitDeps } from './submit.ts'
import { fetchPrepare, fetchSignatureState, relaySignedTransaction } from './client.ts'
import { resolveSigner } from './provider.ts'
import { checkSignedTransaction, classifyRejection, handleSolanaTransfer } from '../../../api/solana-transfer.ts'
import { SOLANA_DEVNET_GENESIS_HASH } from '../network/testnet.ts'

const OWN = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const OTHER = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
const SIG = '5'.repeat(88)
const BLOCKHASH = 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N'

test('parseSolAmount: exact lamports and strict format', () => {
  assert.deepEqual(parseSolAmount('1'), { ok: true, lamports: LAMPORTS_PER_SOL })
  assert.deepEqual(parseSolAmount('0.000000001'), { ok: true, lamports: 1n })
  for (const bad of ['', '0', '-1', '1e3', '0.0000000001', 'x', '1.2.3']) assert.equal(parseSolAmount(bad).ok, false, bad)
})

test('validateSolRecipient: base58, not self, not system program, not an 0x address', () => {
  assert.equal(validateSolRecipient(OTHER, OWN).ok, true)
  assert.equal(validateSolRecipient(OWN, OWN).ok, false)
  assert.equal(validateSolRecipient(SYSTEM_PROGRAM_ADDRESS, OWN).ok, false)
  assert.equal(validateSolRecipient('0x52908400098527886E0F7030069857D2E4169EE7', OWN).ok, false)
  assert.equal(validateSolRecipient('', OWN).ok, false)
})

test('affordability: fee, sender rent and new-recipient rent', () => {
  const s = { balance: 2n * LAMPORTS_PER_SOL, fee: 5000n, rentExemptMinimum: 890_880n, recipientBalance: 0n }
  assert.equal(checkAffordability(LAMPORTS_PER_SOL, s), null)
  assert.match(checkAffordability(3n * LAMPORTS_PER_SOL, s)!, /Not enough/)
  assert.match(checkAffordability(2n * LAMPORTS_PER_SOL - 5000n - 1n, s)!, /below/) // leaves 1 lamport
  assert.equal(checkAffordability(maxSendable(s.balance, s.fee), s), null) // emptying the account is allowed
  assert.match(checkAffordability(1000n, s)!, /recipient has no SOL/)
})

test('gate: only a positively verified Devnet session passes', () => {
  assert.equal(evaluateSolSendGate({ address: OWN, networkName: 'Solana Devnet' }).allowed, true)
  assert.equal(evaluateSolSendGate({ address: OWN, networkName: 'Solana' }).allowed, false)
  assert.equal(evaluateSolSendGate({ address: OWN, networkName: 'Solana Testnet' }).allowed, false)
  assert.equal(evaluateSolSendGate({ address: OWN, networkName: null }).allowed, false)
  assert.equal(evaluateSolSendGate({ address: null, networkName: 'Solana Devnet' }).allowed, false)
  assert.equal(evaluateSolSendGate({ address: OWN, networkName: 'Solana Devnet', restoring: true }).allowed, false)
})

test('classifyTransferError', () => {
  assert.equal(classifyTransferError({ message: 'User rejected the request.' }).kind, 'user-rejected')
  assert.equal(classifyTransferError(new TransferError('rpc-failure')).kind, 'rpc-failure')
  assert.equal(classifyTransferError(new Error('https://x/key')).kind, 'unknown')
})

test('resolveSigner: needs signTransaction and the matching account', () => {
  assert.throws(() => resolveSigner({}, OWN), (e: unknown) => (e as TransferError).kind === 'wallet-unsupported')
  assert.throws(() => resolveSigner({ signTransaction: async () => 1, publicKey: OTHER }, OWN), (e: unknown) => (e as TransferError).kind === 'wallet-mismatch')
  assert.equal(typeof resolveSigner({ signTransaction: async () => 1, publicKey: OWN }, OWN), 'function')
})

const prepared = { balance: 2n * LAMPORTS_PER_SOL, fee: 5000n, rentExemptMinimum: 890_880n, recipientBalance: 1n, blockhash: BLOCKHASH, lastValidBlockHeight: 100 }
function deps(over: Partial<SubmitDeps> = {}, calls: string[] = []): SubmitDeps {
  return { gateMessage: () => null, prepare: async () => { calls.push('prepare'); return prepared }, sign: async () => { calls.push('sign'); return 'c2lnbmVk' }, relay: async () => { calls.push('relay'); return SIG }, ...over }
}
const intent = { from: OWN, to: OTHER, lamports: LAMPORTS_PER_SOL }

test('submit: prepare → sign → relay in order', async () => {
  const calls: string[] = []
  const out = await submitSolTransfer(deps({}, calls), intent)
  assert.equal(out.status, 'submitted')
  assert.deepEqual(calls, ['prepare', 'sign', 'relay'])
})

test('submit: gate, affordability and wallet rejection stop before relay; relay failure is flagged afterSigning', async () => {
  const calls: string[] = []
  assert.equal((await submitSolTransfer(deps({ gateMessage: () => 'Devnet only' }, calls), intent)).status, 'blocked')
  assert.equal((await submitSolTransfer(deps({}, calls), { ...intent, lamports: 5n * LAMPORTS_PER_SOL })).status, 'blocked')
  const rejected = await submitSolTransfer(deps({ sign: async () => { throw { code: 4001 } } }, calls), intent)
  assert.ok(rejected.status === 'failed' && rejected.failure.kind === 'user-rejected' && !rejected.afterSigning)
  assert.ok(!calls.includes('relay'))
  const relayFail = await submitSolTransfer(deps({ relay: async () => { throw new TransferError('timeout') } }), intent)
  assert.ok(relayFail.status === 'failed' && relayFail.afterSigning)
})

function sending(): SolTransferState {
  return solTransferReducer(solTransferReducer(initialSolTransferState, { type: 'review', review: { recipient: OTHER, lamports: 1n } }), { type: 'send' })
}

test('flow: duplicate send ignored; success only after chain confirmation', () => {
  const s = sending()
  assert.equal(solTransferReducer(s, { type: 'send' }), s)
  const c = solTransferReducer(s, { type: 'outcome', outcome: { status: 'submitted', signature: SIG, lastValidBlockHeight: 10, fee: 5000n } })
  assert.equal(c.phase, 'confirming'); assert.equal(c.notice, null)
  assert.equal(solTransferReducer(c, { type: 'poll', state: 'processed' }).phase, 'confirming')
  assert.equal(solTransferReducer(c, { type: 'poll', state: 'finalized' }).notice?.tone, 'success')
  assert.equal(solTransferReducer(c, { type: 'poll', state: 'failed' }).notice?.tone, 'error')
  assert.equal(solTransferReducer(c, { type: 'poll', state: 'expired' }).notice?.tone, 'error')
  assert.equal(solTransferReducer(c, { type: 'poll-timeout' }).notice?.tone, 'info')
})

function fakeFetch(body: unknown, status = 200, record?: { url?: string; init?: RequestInit }): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    if (record) { record.url = String(url); record.init = init }
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

test('client: prepare requires Devnet genesis; relay and status validate shapes', async () => {
  const good = { cluster: 'devnet', genesisHash: SOLANA_DEVNET_GENESIS_HASH, address: OWN, balanceLamports: '100', feeLamports: '5000', rentExemptMinimumLamports: '890880', recipientLamports: null, blockhash: BLOCKHASH, lastValidBlockHeight: 5 }
  assert.equal((await fetchPrepare(OWN, null, { fetchImpl: fakeFetch(good) })).balance, 100n)
  await assert.rejects(fetchPrepare(OWN, null, { fetchImpl: fakeFetch({ ...good, cluster: 'mainnet-beta' }) }), (e: unknown) => (e as TransferError).kind === 'network-mismatch')
  await assert.rejects(fetchPrepare(OWN, null, { fetchImpl: fakeFetch({ ...good, genesisHash: 'x' }) }), (e: unknown) => (e as TransferError).kind === 'network-mismatch')
  assert.equal(await relaySignedTransaction('AAAA', { fetchImpl: fakeFetch({ cluster: 'devnet', signature: SIG }) }), SIG)
  await assert.rejects(relaySignedTransaction('AAAA', { fetchImpl: fakeFetch({ error: { code: 'rejected', reason: 'insufficient-funds' } }, 422) }), (e: unknown) => (e as TransferError).kind === 'insufficient-funds')
  assert.equal(await fetchSignatureState(SIG, 5, { fetchImpl: fakeFetch({ signature: SIG, state: 'confirmed' }) }), 'confirmed')
})

test('api: classifyRejection and signed-transaction sanity checks', () => {
  assert.equal(classifyRejection('blockhash not found'), 'blockhash-expired')
  assert.equal(classifyRejection('attempt to debit an account but found no record of a prior credit'), 'insufficient-funds')
  assert.equal(classifyRejection('transaction signature verification failure'), 'invalid-signature')
  assert.equal(classifyRejection('something else'), 'rejected')
  const signed = Buffer.concat([Buffer.from([1]), Buffer.alloc(64, 7), Buffer.alloc(40, 1)]).toString('base64')
  assert.equal(checkSignedTransaction(signed), 105)
  const unsigned = Buffer.concat([Buffer.from([1]), Buffer.alloc(64, 0), Buffer.alloc(40, 1)]).toString('base64')
  assert.throws(() => checkSignedTransaction(unsigned))
  assert.throws(() => checkSignedTransaction('not base64!'))
})

test('api: relay refuses when the upstream is not Devnet, and never sends an unsigned transaction', async () => {
  const calls: string[] = []
  const rpc = (genesis: string): typeof fetch => (async (_u: unknown, init?: RequestInit) => {
    const { method } = JSON.parse(String(init?.body)) as { method: string }
    calls.push(method)
    const result = method === 'getGenesisHash' ? genesis : SIG
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  const signed = Buffer.concat([Buffer.from([1]), Buffer.alloc(64, 7), Buffer.alloc(40, 1)]).toString('base64')
  const post = (body: unknown) => new Request('http://localhost/api/solana-transfer', { method: 'POST', body: JSON.stringify(body) })
  const wrong = await handleSolanaTransfer(post({ transaction: signed }), { fetchImpl: rpc('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d') })
  assert.equal(wrong.status, 502)
  assert.ok(!calls.includes('sendTransaction'))
  const ok = await handleSolanaTransfer(post({ transaction: signed }), { fetchImpl: rpc(SOLANA_DEVNET_GENESIS_HASH) })
  assert.equal(ok.status, 200)
  assert.deepEqual(await ok.json(), { cluster: 'devnet', signature: SIG })
  const bad = await handleSolanaTransfer(post({ transaction: 'AAAA' }), { fetchImpl: rpc(SOLANA_DEVNET_GENESIS_HASH) })
  assert.equal(bad.status, 400)
})
