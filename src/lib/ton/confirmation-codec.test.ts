import assert from 'node:assert/strict'
import test from 'node:test'
import {
  Address, beginCell, Cell, Dictionary, loadMessage, storeMessage, storeTransaction,
  type Message, type Transaction,
} from '@ton/core'
import { extractTrackedMessage, getNormalizedExtMessageHash, tonCodec } from './confirmation-codec.ts'
import { classifySenderExecution, lookupTransfer } from './confirmation.ts'

const WALLET = Address.parseRaw(`0:${'aa'.repeat(32)}`)
const RECIPIENT = Address.parseRaw(`0:${'bb'.repeat(32)}`)

function extMessage(opts: { importFee?: bigint } = {}): Message {
  return {
    info: { type: 'external-in', dest: WALLET, importFee: opts.importFee ?? 0n },
    init: null,
    body: beginCell().storeUint(0x7362d09c, 32).storeUint(42, 32).endCell(),
  }
}
function bocOf(message: Message, forceRef: boolean): string {
  return beginCell().store(storeMessage(message, { forceRef })).endCell().toBoc().toString('base64')
}

// ─── Message identity (TEP-467) ──────────────────────────────────────────────

test('extractTrackedMessage returns the wallet account and a 64-hex normalized hash', () => {
  const t = extractTrackedMessage(bocOf(extMessage(), true))
  assert.ok(t)
  assert.equal(t.account, WALLET.toRawString())
  assert.match(t.hash, /^[0-9a-f]{64}$/)
})

test('normalized hash is stable across body inline/ref layout and import_fee', () => {
  const a = extractTrackedMessage(bocOf(extMessage(), true))
  const b = extractTrackedMessage(bocOf(extMessage(), false))
  const c = extractTrackedMessage(bocOf(extMessage({ importFee: 12_345n }), true))
  assert.ok(a && b && c)
  assert.equal(a.hash, b.hash)
  assert.equal(a.hash, c.hash)
})

test('different requests (different body) have different hashes', () => {
  const other: Message = { ...extMessage(), body: beginCell().storeUint(7, 32).endCell() }
  assert.notEqual(getNormalizedExtMessageHash(extMessage()), getNormalizedExtMessageHash(other))
})

test('extractTrackedMessage returns null for unusable input instead of guessing', () => {
  assert.equal(extractTrackedMessage(''), null)
  assert.equal(extractTrackedMessage('notvalidbase64!!!!'), null)
  assert.equal(extractTrackedMessage('dGVzdA=='), null)
  const internal = {
    info: { type: 'internal', ihrDisabled: true, bounce: true, bounced: false, src: WALLET, dest: RECIPIENT, value: { coins: 1n }, ihrFee: 0n, forwardFee: 0n, createdLt: 0n, createdAt: 0 },
    body: Cell.EMPTY,
  } as unknown as Message
  assert.equal(extractTrackedMessage(bocOf(internal, true)), null)
})

// ─── Transaction decoding (what toncenter v2 returns in `data`) ──────────────

const messageValue = {
  serialize(src: Message, builder: any) {
    builder.storeRef(beginCell().store(storeMessage(src)))
  },
  parse(slice: any): Message {
    return loadMessage(slice.loadRef().beginParse())
  },
}

function txBoc(description: Transaction['description'], inMessage: Message, outMessages: Message[], lt = 2000n): string {
  const outs = Dictionary.empty(Dictionary.Keys.Uint(15), messageValue)
  outMessages.forEach((m, i) => outs.set(i, m))
  const tx = {
    address: BigInt(`0x${'aa'.repeat(32)}`),
    lt, prevTransactionHash: 0n, prevTransactionLt: 0n, now: 1_700_000_000,
    outMessagesCount: outMessages.length, oldStatus: 'active', endStatus: 'active',
    inMessage, outMessages: outs, totalFees: { coins: 1_000_000n },
    stateUpdate: { oldHash: Buffer.alloc(32), newHash: Buffer.alloc(32) },
    description, raw: Cell.EMPTY, hash: () => Buffer.alloc(32),
  } as unknown as Transaction
  return beginCell().store(storeTransaction(tx)).endCell().toBoc().toString('base64')
}
const internalOut = {
  info: { type: 'internal', ihrDisabled: true, bounce: true, bounced: false, src: WALLET, dest: RECIPIENT, value: { coins: 100_000_000n }, ihrFee: 0n, forwardFee: 0n, createdLt: 2000n, createdAt: 1_700_000_000 },
  body: Cell.EMPTY,
} as unknown as Message
function generic(over: { success: boolean; actionSuccess?: boolean; aborted?: boolean }): Transaction['description'] {
  return {
    type: 'generic', creditFirst: false, aborted: over.aborted ?? false, destroyed: false,
    computePhase: { type: 'vm', success: over.success, messageStateUsed: false, accountActivated: false, gasFees: 1n, gasUsed: 1n, gasLimit: 1n, gasCredit: undefined, mode: 0, exitCode: over.success ? 0 : 7, vmSteps: 1, vmInitStateHash: 0n, vmFinalStateHash: 0n },
    actionPhase: over.actionSuccess === undefined ? undefined : {
      success: over.actionSuccess, valid: true, noFunds: false, statusChange: 'unchanged', totalFwdFees: undefined, totalActionFees: undefined,
      resultCode: over.actionSuccess ? 0 : 37, resultArg: undefined, totalActions: 1, specActions: 0, skippedActions: 0, messagesCreated: 1, actionListHash: 0n, totalMessageSize: { cells: 1n, bits: 1n },
    },
  } as Transaction['description']
}

test('tonCodec decodes a real wallet transaction BOC: hash match, internal out-message identity and success phases', () => {
  const ext = extMessage()
  const parsed = tonCodec.parseTransaction(txBoc(generic({ success: true, actionSuccess: true }), ext, [internalOut]))
  assert.ok(parsed)
  assert.equal(parsed.lt, '2000')
  assert.equal(parsed.inMessage?.kind, 'external-in')
  assert.equal(parsed.inMessage?.normalizedHash, getNormalizedExtMessageHash(ext))
  assert.deepEqual(parsed.outMessages[0], { kind: 'internal', src: WALLET.toRawString(), dest: RECIPIENT.toRawString(), createdLt: '2000' })
  assert.deepEqual(parsed.phases, { aborted: false, compute: 'success', action: 'success', bounced: false })
  assert.equal(classifySenderExecution(parsed), 'success')
})

test('tonCodec reports failed compute / failed action phases', () => {
  const failedCompute = tonCodec.parseTransaction(txBoc(generic({ success: false }), extMessage(), []))
  assert.equal(failedCompute?.phases?.compute, 'failed')
  assert.equal(classifySenderExecution(failedCompute!), 'failed')
  const failedAction = tonCodec.parseTransaction(txBoc(generic({ success: true, actionSuccess: false, aborted: true }), extMessage(), []))
  assert.equal(failedAction?.phases?.action, 'failed')
  assert.equal(classifySenderExecution(failedAction!), 'failed')
})

test('tonCodec returns null for missing or malformed data', () => {
  for (const v of [undefined, null, '', 'zzz', 'dGVzdA==', 5]) assert.equal(tonCodec.parseTransaction(v), null)
})

test('end to end: lookupTransfer finds the transaction by normalized hash using real BOCs', async () => {
  const ext = extMessage()
  const tracked = extractTrackedMessage(bocOf(ext, true))!
  const wallet = txBoc(generic({ success: true, actionSuccess: true }), ext, [internalOut])
  const deliveryDesc = { type: 'generic', creditFirst: true, aborted: false, destroyed: false, computePhase: { type: 'skipped', reason: 'no-state' } } as Transaction['description']
  const delivery = txBoc(deliveryDesc, internalOut, [], 3000n)
  const fetchImpl = (async (input: string) => {
    const u = new URL(String(input))
    const rows = u.searchParams.get('address') === WALLET.toRawString()
      ? [{ transaction_id: { lt: '2000', hash: 'x' }, data: wallet }]
      : [{ transaction_id: { lt: '3000', hash: 'y' }, data: delivery }]
    return new Response(JSON.stringify({ ok: true, result: rows }), { status: 200 })
  }) as unknown as typeof fetch
  const r = await lookupTransfer(tracked, 1000n, { fetchImpl, codec: tonCodec })
  assert.equal(r.state, 'success')
})
