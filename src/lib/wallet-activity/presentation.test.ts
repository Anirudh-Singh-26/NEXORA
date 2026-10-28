import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildEvmRow, buildSolanaRow, describeTransfer, formatActivityAmount } from './presentation.ts'
import { parseEvmActivityResponse, parseSolanaActivityResponse, type EvmEntry } from './wallet-activity.ts'

const ME = '0xabcdef0123456789abcdef0123456789abcdef01'
const OTHER = '0x1111111111111111111111111111111111111111'
const TOKEN = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const hash = (n: number) => '0x' + n.toString(16).padStart(64, '0')
const t = (over: Record<string, unknown> = {}) => ({ category: 'external', from: ME, to: OTHER, asset: 'ETH', amount: '1.5', contract: null, tokenId: null, ...over })
const row = (transfers: unknown[], timestamp: string | null = '2025-01-02T03:04:05.000Z'): EvmEntry =>
  parseEvmActivityResponse({ chainId: 1, address: ME, items: [{ hash: hash(9), blockNumber: 9, timestamp, transfers }], nextCursor: null }).items[0]

test('formatActivityAmount: groups, truncates, handles tiny and missing values', () => {
  assert.equal(formatActivityAmount('1234567.1234567891'), '1,234,567.123456')
  assert.equal(formatActivityAmount('0.0000001'), '<0.000001')
  assert.equal(formatActivityAmount('0'), '0')
  assert.equal(formatActivityAmount('2.500'), '2.5')
  assert.equal(formatActivityAmount(null), null)
  assert.equal(formatActivityAmount('abc'), null)
})

test('buildEvmRow: sent native transfer with explorer link and counterparty', () => {
  const view = buildEvmRow(row([t()]), ME.toUpperCase().replace('0X', '0x'), 8453, new Date('2025-01-02T12:00:00'))
  assert.equal(view.headline, 'Sent 1.5 ETH')
  assert.equal(view.typeLabel, 'Native transfer')
  assert.equal(view.url, `https://basescan.org/tx/${hash(9)}`)
  assert.deepEqual(view.transfers[0].counterparty, { label: 'To', address: OTHER })
  assert.equal(view.group, 'Today')
})

test('buildEvmRow: zero-value transaction is not mislabelled; missing amount/timestamp are stated, not invented', () => {
  const zero = buildEvmRow(row([t({ amount: '0' })]), ME, 1)
  assert.equal(zero.headline, 'Sent transaction (no native value)')
  assert.equal(zero.typeLabel, 'Transaction')
  const missing = buildEvmRow(row([t({ amount: null, asset: null })], null), ME, 137)
  assert.equal(missing.headline, 'Sent POL (amount not provided)')
  assert.equal(missing.group, 'Date unavailable')
  assert.equal(missing.timestamp, null)
})

test('buildEvmRow: one entry per transaction even with native + token + NFT events', () => {
  const view = buildEvmRow(row([
    t(),
    t({ category: 'erc20', from: OTHER, to: ME, asset: 'USDC', amount: '12.5', contract: TOKEN }),
    t({ category: 'erc721', from: OTHER, to: ME, asset: null, amount: null, contract: TOKEN, tokenId: '42' }),
  ]), ME, 1)
  assert.equal(view.transfers.length, 3)
  assert.deepEqual(view.transfers.map((x) => [x.kind, x.direction, x.text]), [['native', 'sent', '1.5 ETH'], ['token', 'received', '12.5 USDC'], ['nft', 'received', 'NFT #42']])
})

test('describeTransfer: NFT quantities, self and third-party transfers', () => {
  const erc1155 = describeTransfer({ category: 'erc1155', from: OTHER, to: ME, asset: null, amount: '3', contract: TOKEN, tokenId: '7' }, ME, 'ETH')
  assert.equal(erc1155.text, '3 × NFT #7')
  assert.equal(describeTransfer({ category: 'external', from: ME, to: ME, asset: 'ETH', amount: '1', contract: null, tokenId: null }, ME, 'ETH').direction, 'self')
  const third = describeTransfer({ category: 'erc20', from: OTHER, to: TOKEN, asset: null, amount: null, contract: TOKEN, tokenId: null }, ME, 'ETH')
  assert.equal(third.direction, 'other')
  assert.equal(third.counterparty, null)
})

test('buildSolanaRow: status, time and Devnet explorer link', () => {
  const sig = `${'5'.repeat(86)}Az`
  const [ok, unknown] = parseSolanaActivityResponse({ cluster: 'devnet', address: '11111111111111111111111111111112', items: [
    { signature: sig, slot: 5, blockTime: 1_700_000_000, status: 'failed', confirmation: 'finalized' },
    { signature: `${'6'.repeat(86)}Bz`, slot: 4, blockTime: null, status: null, confirmation: null },
  ] }).items
  const a = buildSolanaRow(ok)
  assert.equal(a.status, 'failed')
  assert.equal(a.statusLabel, 'Failed')
  assert.equal(a.url, `https://explorer.solana.com/tx/${sig}?cluster=devnet`)
  assert.equal(a.timestamp, new Date(1_700_000_000_000).toISOString())
  assert.equal(a.detailsUnavailable, true) // no details were supplied: say so, claim nothing
  const b = buildSolanaRow(unknown)
  assert.equal(b.group, 'Date unavailable')
  assert.equal(b.status, null)
  assert.equal(b.statusLabel, 'Status unknown')
  assert.equal(b.amountText, null)
})

test('buildSolanaRow: sent / received / failed / program / pending rows are described honestly', () => {
  const me = '11111111111111111111111111111112'
  const other = '11111111111111111111111111111113'
  const make = (n: number, status: 'success' | 'failed', confirmation: 'processed' | 'confirmed' | 'finalized', details: unknown) => parseSolanaActivityResponse({ cluster: 'devnet', address: me, items: [
    { signature: `${String(n).repeat(86)}Az`, slot: 1, blockTime: 1_700_000_000, status, confirmation, details },
  ] }).items[0]
  const sent = buildSolanaRow(make(5, 'success', 'finalized', { kind: 'transfer', direction: 'sent', counterparty: other, lamports: '1500000000', netChangeLamports: '-1500005000', feeLamports: '5000' }))
  assert.equal(sent.headline, 'Sent 1.5 SOL')
  assert.equal(sent.amountText, '-1.5 SOL')
  assert.equal(sent.feeText, '0.000005 SOL')
  assert.equal(sent.counterparty?.full, other)
  assert.equal(sent.statusLabel, 'Finalized')
  const received = buildSolanaRow(make(6, 'success', 'confirmed', { kind: 'transfer', direction: 'received', counterparty: other, lamports: '2000000000', netChangeLamports: '2000000000', feeLamports: null }))
  assert.equal(received.headline, 'Received 2 SOL')
  assert.equal(received.amountText, '+2 SOL')
  assert.equal(received.statusLabel, 'Confirmed')
  // A failed transaction moved no SOL: no amount, even though the instructions named one.
  const failed = buildSolanaRow(make(7, 'failed', 'finalized', { kind: 'transfer', direction: 'sent', counterparty: other, lamports: null, netChangeLamports: '-5000', feeLamports: '5000' }))
  assert.equal(failed.headline, 'Failed transaction')
  assert.equal(failed.amountText, null)
  assert.equal(failed.netChangeText, '-0.000005 SOL')
  // Not a plain transfer: only the wallet's own balance change is reported, never an invented amount or direction.
  const program = buildSolanaRow(make(8, 'success', 'finalized', { kind: 'other', direction: 'other', counterparty: null, lamports: null, netChangeLamports: '-2039280', feeLamports: '5000' }))
  assert.equal(program.headline, 'Program interaction')
  assert.equal(program.amountText, null)
  assert.equal(program.netChangeText, '-0.00203928 SOL')
  // 'processed' is shown as not yet confirmed.
  assert.equal(buildSolanaRow(make(9, 'success', 'processed', null)).statusLabel, 'Processing')
})
