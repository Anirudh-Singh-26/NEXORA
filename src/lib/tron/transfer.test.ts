import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'
import { bytesToHex, decodeTronAddress, encodeTronAddress, isValidTronAddress, sha256 } from './encoding.ts'
import { classifyTronNetwork, MAINNET_CHAIN_ID, shastaTxUrl, SHASTA_CHAIN_ID } from './network.ts'
import {
  broadcastShastaTransaction, buildShastaTransfer, checkSufficientBalance, evaluateSendGate, fetchShastaTxStatus, MAX_SEND_SUN, parseTrxAmount,
  TransferError, validateRecipient, verifySignedMatches, verifyUnsignedTransfer, type TronTx,
} from './transfer.ts'

function addr(seed: number): string {
  const payload = new Uint8Array(21).fill(seed)
  payload[0] = 0x41
  return encodeTronAddress(payload)
}
const SENDER = addr(0x11)
const RECIPIENT = addr(0x22)
const OTHER = addr(0x33)

/* --- minimal protobuf writer to build a realistic unsigned TransferContract transaction (test-only) --- */
const varint = (n: bigint): number[] => { const out: number[] = []; let v = n; do { let b = Number(v & 0x7fn); v >>= 7n; if (v > 0n) b |= 0x80; out.push(b) } while (v > 0n); return out }
const lenField = (field: number, bytes: number[]): number[] => [...varint(BigInt((field << 3) | 2)), ...varint(BigInt(bytes.length)), ...bytes]
const varField = (field: number, v: bigint): number[] => [...varint(BigInt(field << 3)), ...varint(v)]

function makeTx(opts: { owner?: string; to?: string; amount?: bigint; expiration?: number; contractType?: number; memo?: boolean; jsonAmount?: number; txIdOverride?: string } = {}): TronTx {
  const owner = opts.owner ?? SENDER
  const to = opts.to ?? RECIPIENT
  const amount = opts.amount ?? 1_500_000n
  const expiration = opts.expiration ?? 1_900_000_000_000
  const inner = [...lenField(1, [...decodeTronAddress(owner)!]), ...lenField(2, [...decodeTronAddress(to)!]), ...varField(3, amount)]
  const any = [...lenField(1, [...Buffer.from('type.googleapis.com/protocol.TransferContract')]), ...lenField(2, inner)]
  const contract = [...varField(1, BigInt(opts.contractType ?? 1)), ...lenField(2, any)]
  const raw = [...lenField(1, [0xab, 0xcd]), ...lenField(4, new Array<number>(8).fill(7)), ...varField(8, BigInt(expiration)), ...(opts.memo ? lenField(10, [0x68, 0x69]) : []), ...lenField(11, contract), ...varField(14, 1_800_000_000_000n)]
  const hex = Buffer.from(raw).toString('hex')
  return {
    visible: true,
    txID: opts.txIdOverride ?? createHash('sha256').update(Buffer.from(raw)).digest('hex'),
    raw_data: { contract: [{ type: 'TransferContract', parameter: { value: { owner_address: owner, to_address: to, amount: opts.jsonAmount ?? Number(amount) }, type_url: 'type.googleapis.com/protocol.TransferContract' } }], expiration, timestamp: 1_800_000_000_000 },
    raw_data_hex: hex,
  }
}

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const INTENT = { sender: SENDER, recipient: RECIPIENT, sun: 1_500_000n }

describe('encoding', () => {
  it('sha256 matches node:crypto, including multi-block inputs', () => {
    for (const size of [0, 1, 55, 56, 63, 64, 65, 200, 1000]) {
      const data = new Uint8Array(size).map((_, i) => (i * 31 + 7) & 255)
      assert.equal(bytesToHex(sha256(data)), createHash('sha256').update(data).digest('hex'), `size ${size}`)
    }
  })
  it('round-trips base58check and knows the zero address', () => {
    assert.equal(encodeTronAddress(Uint8Array.from([0x41, ...new Array<number>(20).fill(0)])), 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb')
    assert.ok(isValidTronAddress('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'))
    assert.deepEqual(decodeTronAddress(SENDER), Uint8Array.from([0x41, ...new Array<number>(20).fill(0x11)]))
  })
  it('rejects a bad checksum, wrong prefix, wrong length and non-base58', () => {
    const last = SENDER.slice(-1)
    const broken = SENDER.slice(0, -1) + (last === '2' ? '3' : '2')
    assert.equal(isValidTronAddress(broken), false)
    assert.equal(isValidTronAddress(SENDER.slice(0, -1)), false)
    assert.equal(isValidTronAddress('0x' + 'a'.repeat(40)), false)
    assert.equal(isValidTronAddress('T' + 'l'.repeat(33)), false)
    assert.equal(isValidTronAddress(''), false)
  })
})

describe('parseTrxAmount', () => {
  const sun = (text: string) => { const r = parseTrxAmount(text); assert.ok(r.ok, text); return r.sun }
  const problem = (text: string) => { const r = parseTrxAmount(text); assert.equal(r.ok, false, text); return r.ok ? null : r.problem }
  it('converts exactly with 1 TRX = 1,000,000 SUN', () => {
    assert.equal(sun('1'), 1_000_000n)
    assert.equal(sun('0.000001'), 1n)
    assert.equal(sun('1.5'), 1_500_000n)
    assert.equal(sun('  12.345678 '), 12_345_678n)
    assert.equal(sun('0.1'), 100_000n)
    assert.equal(sun('0.3'), 300_000n)
    assert.equal(sun('1.10'), 1_100_000n)
    assert.equal(sun('007'), 7_000_000n)
  })
  it('is exact where floating point is not', () => {
    assert.equal(sun('4.35'), 4_350_000n) // 4.35 * 100 === 434.99999999999994 in IEEE-754
    assert.equal(sun('1.005'), 1_005_000n)
    assert.equal(sun('9007199254.740991'), 9_007_199_254_740_991n)
  })
  it('enforces the 6-decimal boundary without rounding', () => {
    assert.equal(problem('0.0000001'), 'precision')
    assert.equal(problem('1.1234567'), 'precision')
    assert.equal(problem('0.0000009'), 'precision')
    assert.equal(sun('1.123456'), 1_123_456n)
  })
  it('rejects zero, negative and malformed input', () => {
    assert.equal(problem(''), 'empty')
    assert.equal(problem('   '), 'empty')
    assert.equal(problem('0'), 'zero')
    assert.equal(problem('0.000000'), 'zero')
    for (const bad of ['-1', '+1', '1e3', '1,5', '1 5', '.5', '1.', 'abc', 'NaN', 'Infinity', '0x10', '1.2.3', '１']) assert.equal(problem(bad), 'format', bad)
  })
  it('caps the amount at what a JSON number carries exactly', () => {
    assert.equal(sun('9007199254.740991'), MAX_SEND_SUN)
    assert.equal(problem('9007199254.740992'), 'too-large')
    assert.equal(problem('99999999999999999999'), 'too-large')
  })
})

describe('validateRecipient', () => {
  it('accepts a valid different address', () => assert.deepEqual(validateRecipient(RECIPIENT, SENDER), { ok: true }))
  it('rejects empty, malformed and EVM-style addresses', () => {
    assert.equal(validateRecipient('', SENDER).ok, false)
    const evm = validateRecipient('0x' + '1'.repeat(40), SENDER)
    assert.ok(!evm.ok && evm.problem === 'invalid')
    const bad = validateRecipient(RECIPIENT.slice(0, -1) + (RECIPIENT.endsWith('2') ? '3' : '2'), SENDER)
    assert.ok(!bad.ok && bad.problem === 'invalid')
  })
  it('rejects the sender’s own address', () => {
    const self = validateRecipient(SENDER, SENDER)
    assert.ok(!self.ok && self.problem === 'self')
    assert.ok(!validateRecipient(`  ${SENDER}  `, SENDER).ok)
  })
})

describe('checkSufficientBalance', () => {
  it('compares integer SUN only', () => {
    assert.deepEqual(checkSufficientBalance(2_000_000n, 1_000_000n), { ok: true, leavesNothingForFees: false })
    assert.deepEqual(checkSufficientBalance(1_000_000n, 1_000_000n), { ok: true, leavesNothingForFees: true })
    assert.equal(checkSufficientBalance(999_999n, 1_000_000n).ok, false)
  })
})

describe('evaluateSendGate', () => {
  const shasta = classifyTronNetwork({ chainId: SHASTA_CHAIN_ID, networkType: 'Shasta' })
  const base = { connected: true, address: SENDER, expectedSender: SENDER }
  it('allows only a connected, same-account, verified-Shasta wallet', () => assert.deepEqual(evaluateSendGate({ ...base, identity: shasta }), { ok: true }))
  it('blocks Mainnet, Nile, unknown, inconsistent and unread networks', () => {
    const cases = [classifyTronNetwork({ chainId: MAINNET_CHAIN_ID }), classifyTronNetwork({ chainId: '0xcd8690dc' }), classifyTronNetwork({ chainId: '0xdeadbeef', networkType: 'Shasta' }), classifyTronNetwork({ chainId: SHASTA_CHAIN_ID, networkType: 'Mainnet' }), null]
    for (const identity of cases) assert.equal(evaluateSendGate({ ...base, identity }).ok, false)
    const main = evaluateSendGate({ ...base, identity: cases[0] })
    assert.ok(!main.ok && main.reason === 'not-shasta')
    const unread = evaluateSendGate({ ...base, identity: null })
    assert.ok(!unread.ok && unread.reason === 'network-unverified')
  })
  it('blocks when disconnected or when the account changed', () => {
    assert.equal(evaluateSendGate({ connected: false, address: null, expectedSender: null, identity: shasta }).ok, false)
    const changed = evaluateSendGate({ ...base, address: OTHER, identity: shasta })
    assert.ok(!changed.ok && changed.reason === 'account-changed')
  })
})

describe('verifyUnsignedTransfer', () => {
  it('accepts a faithful transaction', () => assert.doesNotThrow(() => verifyUnsignedTransfer(makeTx(), INTENT)))
  const rejects = (tx: TronTx) => assert.throws(() => verifyUnsignedTransfer(tx, INTENT), (e: unknown) => e instanceof TransferError && e.kind === 'mismatch')
  it('rejects a different recipient, sender or amount in the signed bytes', () => {
    rejects(makeTx({ to: OTHER }))
    rejects(makeTx({ owner: OTHER }))
    rejects(makeTx({ amount: 1_500_001n }))
  })
  it('rejects JSON that disagrees with the bytes, a wrong txID, a memo and a non-transfer contract', () => {
    rejects(makeTx({ jsonAmount: 1 }))
    rejects(makeTx({ txIdOverride: '00'.repeat(32) }))
    rejects(makeTx({ memo: true }))
    rejects(makeTx({ contractType: 31 }))
  })
  it('rejects garbage bytes', () => rejects({ ...makeTx(), raw_data_hex: 'zz' }))
})

describe('verifySignedMatches', () => {
  it('requires identical bytes plus a signature', () => {
    const tx = makeTx()
    assert.doesNotThrow(() => verifySignedMatches(tx, { ...tx, signature: ['ab12'] }))
    assert.throws(() => verifySignedMatches(tx, tx), TransferError)
    assert.throws(() => verifySignedMatches(tx, { ...makeTx({ amount: 9n }), signature: ['ab12'] }), TransferError)
    assert.throws(() => verifySignedMatches(tx, { ...tx, signature: [] }), TransferError)
  })
})

describe('buildShastaTransfer / broadcast (mocked RPC; nothing real is sent)', () => {
  it('builds only against the Shasta createtransaction endpoint and verifies the result', async () => {
    const urls: string[] = []
    let body = ''
    const tx = makeTx()
    const tx2 = await buildShastaTransfer(INTENT, { fetchImpl: async (u, init) => { urls.push(String(u)); body = String(init?.body); return json(tx) } })
    assert.deepEqual(urls, ['https://api.shasta.trongrid.io/wallet/createtransaction'])
    assert.deepEqual(JSON.parse(body), { owner_address: SENDER, to_address: RECIPIENT, amount: 1_500_000, visible: true })
    assert.equal(tx2.txID, tx.txID)
  })
  it('refuses a node that returns a different transaction', async () => {
    await assert.rejects(buildShastaTransfer(INTENT, { fetchImpl: async () => json(makeTx({ to: OTHER })) }), (e: unknown) => e instanceof TransferError && e.kind === 'mismatch')
  })
  it('refuses invalid input before any request', async () => {
    let called = false
    const fetchImpl: typeof fetch = async () => { called = true; return json({}) }
    await assert.rejects(buildShastaTransfer({ ...INTENT, recipient: SENDER }, { fetchImpl }), TransferError)
    await assert.rejects(buildShastaTransfer({ ...INTENT, sun: 0n }, { fetchImpl }), TransferError)
    assert.equal(called, false)
  })
  it('maps node errors, HTTP errors and network failures', async () => {
    await assert.rejects(buildShastaTransfer(INTENT, { fetchImpl: async () => json({ Error: 'x' }) }), (e: unknown) => e instanceof TransferError && e.kind === 'rejected-by-node')
    await assert.rejects(buildShastaTransfer(INTENT, { fetchImpl: async () => json({}, 500) }), (e: unknown) => e instanceof TransferError && e.kind === 'http')
    await assert.rejects(buildShastaTransfer(INTENT, { fetchImpl: async () => { throw new TypeError('x') } }), (e: unknown) => e instanceof TransferError && e.kind === 'network')
  })
  it('broadcasts to the fixed endpoint and returns the txID only when accepted', async () => {
    const tx = { ...makeTx({ expiration: Date.now() + 60_000 }), signature: ['ab12'] }
    let url = ''
    const ok = await broadcastShastaTransaction(tx, { fetchImpl: async (u) => { url = String(u); return json({ result: true, txid: tx.txID }) } })
    assert.equal(url, 'https://api.shasta.trongrid.io/wallet/broadcasttransaction')
    assert.deepEqual(ok, { txId: tx.txID })
    const hexMessage = Buffer.from('Validate signature error').toString('hex')
    await assert.rejects(broadcastShastaTransaction(tx, { fetchImpl: async () => json({ code: 'SIGERROR', message: hexMessage }) }), /SIGERROR\): Validate signature error/)
    await assert.rejects(broadcastShastaTransaction(tx, { fetchImpl: async () => json({ result: false }) }), TransferError)
  })
  it('does not broadcast an expired transaction', async () => {
    const tx = { ...makeTx({ expiration: Date.now() - 1 }), signature: ['ab12'] }
    let called = false
    await assert.rejects(broadcastShastaTransaction(tx, { fetchImpl: async () => { called = true; return json({}) } }), (e: unknown) => e instanceof TransferError && e.kind === 'expired')
    assert.equal(called, false)
  })
})

describe('fetchShastaTxStatus', () => {
  const TXID = 'ab'.repeat(32)
  const route = (map: Record<string, unknown>): typeof fetch => async (u) => json(map[new URL(String(u)).pathname] ?? {})
  const EXP = 1_000_000
  it('is confirmed only when the solidity node has it', async () => {
    const s = await fetchShastaTxStatus(TXID, EXP, { fetchImpl: route({ '/walletsolidity/gettransactioninfobyid': { blockNumber: 9, fee: 1100000, receipt: {} } }), now: () => 5 })
    assert.equal(s.state, 'confirmed'); assert.equal(s.blockNumber, 9); assert.equal(s.feeSun, 1_100_000n)
  })
  it('is only "included" when just the full node has it', async () => {
    const s = await fetchShastaTxStatus(TXID, EXP, { fetchImpl: route({ '/wallet/gettransactioninfobyid': { blockNumber: 9, receipt: { result: 'SUCCESS' } } }), now: () => 5 })
    assert.equal(s.state, 'included')
  })
  it('reports on-chain failure', async () => {
    const s = await fetchShastaTxStatus(TXID, EXP, { fetchImpl: route({ '/walletsolidity/gettransactioninfobyid': { blockNumber: 9, result: 'FAILED', resMessage: Buffer.from('REVERT').toString('hex') } }), now: () => 5 })
    assert.equal(s.state, 'failed'); assert.equal(s.message, 'REVERT')
  })
  it('is pending until expiry, then not-found, and never confirmed without a block', async () => {
    assert.equal((await fetchShastaTxStatus(TXID, EXP, { fetchImpl: route({}), now: () => EXP - 1 })).state, 'pending')
    assert.equal((await fetchShastaTxStatus(TXID, EXP, { fetchImpl: route({}), now: () => EXP + 31_000 })).state, 'not-found')
  })
  it('only queries Shasta and rejects malformed IDs', async () => {
    const urls: string[] = []
    await fetchShastaTxStatus(TXID, EXP, { fetchImpl: async (u) => { urls.push(String(u)); return json({}) }, now: () => 5 })
    assert.ok(urls.length === 2 && urls.every((u) => u.startsWith('https://api.shasta.trongrid.io/')))
    await assert.rejects(fetchShastaTxStatus('nope', EXP), TransferError)
  })
  it('builds explorer links only for valid IDs', () => {
    assert.equal(shastaTxUrl(TXID), `https://shasta.tronscan.org/#/transaction/${TXID}`)
    assert.throws(() => shastaTxUrl('../x'), RangeError)
  })
})
