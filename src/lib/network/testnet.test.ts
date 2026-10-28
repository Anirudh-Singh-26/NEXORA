import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildChains } from '../blockchain/networks.ts'
import { ACTIVITY_CHAINS } from '../wallet-activity/chains.ts'
import { NFT_CHAINS } from '../wallet-nfts/chains.ts'
import { ALCHEMY_NETWORKS } from '../wallet-tokens/chains.ts'
import {
  SEPOLIA_CHAIN_ID, SOLANA_DEVNET_GENESIS_HASH, SOLANA_DEVNET_RPC_URL, assertEvmTransactionAllowed, assertSolanaTransactionAllowed, describeEvmChain,
  guardEvmTransaction, guardSolanaTransaction, isSolanaDevnetCaip, isSolanaMainnetUrl, isSupportedEvmChain, sepoliaAddressUrl, sepoliaTxUrl,
  solanaDevnetAddressUrl, solanaDevnetRpcUrl, solanaDevnetTxUrl,
} from './testnet.ts'

const MAINNETS = [1, 10, 56, 137, 8453, 42161, 59144]
const hash = `0x${'ab'.repeat(32)}`
const sig = '5'.repeat(88)

test('Sepolia is chain 11155111 and the only supported EVM chain', () => {
  assert.equal(SEPOLIA_CHAIN_ID, 11155111)
  assert.equal(isSupportedEvmChain(11155111), true)
  for (const id of [...MAINNETS, 0, -1, 1.5, '11155111', null, undefined]) assert.equal(isSupportedEvmChain(id), false, String(id))
})

test('EVM token and activity chain tables include Sepolia with eth-sepolia slug', () => {
  assert.ok(buildChains().some((c) => c.chainId === SEPOLIA_CHAIN_ID))
  assert.ok(Object.keys(ACTIVITY_CHAINS).includes(String(SEPOLIA_CHAIN_ID)))
  assert.ok(Object.keys(ALCHEMY_NETWORKS).includes(String(SEPOLIA_CHAIN_ID)))
  for (const slug of [ACTIVITY_CHAINS[SEPOLIA_CHAIN_ID].alchemy, ALCHEMY_NETWORKS[SEPOLIA_CHAIN_ID]]) assert.equal(slug, 'eth-sepolia')
})

test('EVM transaction guard: allowed only on Sepolia, immediately before submit', () => {
  assert.deepEqual(guardEvmTransaction(SEPOLIA_CHAIN_ID), { ok: true })
  for (const id of MAINNETS) {
    const guard = guardEvmTransaction(id)
    assert.equal(guard.ok, false, `chain ${id}`)
    if (!guard.ok) assert.match(guard.reason, /Sepolia/)
    assert.throws(() => assertEvmTransactionAllowed(id), /Sepolia/)
  }
  const unknown = guardEvmTransaction(null)
  assert.equal(unknown.ok, false)
  assert.throws(() => assertEvmTransactionAllowed(null))
  assert.doesNotThrow(() => assertEvmTransactionAllowed(SEPOLIA_CHAIN_ID))
  assert.match(describeEvmChain(1), /Ethereum Mainnet/)
  assert.equal(describeEvmChain(null), 'an unknown network')
})

test('Solana transaction guard: allowed only on devnet', () => {
  assert.deepEqual(guardSolanaTransaction('devnet'), { ok: true })
  for (const cluster of ['mainnet-beta', 'mainnet', 'testnet', 'localnet', 'Solana', '']) {
    assert.equal(guardSolanaTransaction(cluster).ok, false, cluster)
    assert.throws(() => assertSolanaTransactionAllowed(cluster), /Devnet/)
  }
  assert.equal(guardSolanaTransaction(null).ok, false)
  assert.doesNotThrow(() => assertSolanaTransactionAllowed('devnet'))
})

test('Solana RPC URL is always devnet, with or without a key, and never a mainnet URL', () => {
  assert.equal(solanaDevnetRpcUrl(), SOLANA_DEVNET_RPC_URL)
  assert.equal(SOLANA_DEVNET_RPC_URL, 'https://api.devnet.solana.com')
  assert.equal(solanaDevnetRpcUrl(''), SOLANA_DEVNET_RPC_URL)
  assert.equal(solanaDevnetRpcUrl('k e/y'), 'https://solana-devnet.g.alchemy.com/v2/k%20e%2Fy')
  for (const url of [solanaDevnetRpcUrl(), solanaDevnetRpcUrl('abc')]) assert.equal(isSolanaMainnetUrl(url), false)
  assert.equal(isSolanaMainnetUrl('https://api.mainnet-beta.solana.com'), true)
})

test('the connected Solana network must be the devnet CAIP id', () => {
  assert.equal(isSolanaDevnetCaip(`solana:${SOLANA_DEVNET_GENESIS_HASH.slice(0, 32)}`), true)
  assert.equal(isSolanaDevnetCaip('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'), false) // mainnet
  assert.equal(isSolanaDevnetCaip('solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z'), false) // testnet
  assert.equal(isSolanaDevnetCaip(null), false)
})

test('explorer links are pinned to Sepolia and Solana Devnet and reject malformed input', () => {
  assert.equal(sepoliaTxUrl(hash), `https://sepolia.etherscan.io/tx/${hash}`)
  assert.equal(sepoliaAddressUrl(`0x${'Ab'.repeat(20)}`), `https://sepolia.etherscan.io/address/0x${'ab'.repeat(20)}`)
  assert.equal(sepoliaTxUrl('0x12'), null)
  assert.equal(solanaDevnetTxUrl(sig), `https://explorer.solana.com/tx/${sig}?cluster=devnet`)
  assert.equal(solanaDevnetAddressUrl('11111111111111111111111111111111'), 'https://explorer.solana.com/address/11111111111111111111111111111111?cluster=devnet')
  assert.equal(solanaDevnetTxUrl('javascript:alert(1)'), null)
  for (const url of [sepoliaTxUrl(hash), solanaDevnetTxUrl(sig)]) assert.doesNotMatch(url ?? '', /solscan|\/\/etherscan\.io|mainnet/)
})
