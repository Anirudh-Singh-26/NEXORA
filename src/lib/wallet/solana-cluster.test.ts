import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isSolanaAddress, solanaClusterName } from './solana-cluster.ts'
import { verifySolanaNetwork } from '../network/environments.ts'

test('isSolanaAddress accepts base58 public keys and rejects EVM addresses and junk', () => {
  assert.equal(isSolanaAddress('11111111111111111111111111111111'), true)
  assert.equal(isSolanaAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'), true)
  assert.equal(isSolanaAddress('0x1234567890abcdef1234567890abcdef12345678'), false)
  assert.equal(isSolanaAddress('0OIl1111111111111111111111111111111'), false)
  assert.equal(isSolanaAddress(''), false)
  assert.equal(isSolanaAddress(undefined), false)
})

test('solanaClusterName reads the account’s own cluster from its CAIP address', () => {
  const addr = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
  assert.equal(solanaClusterName(`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${addr}`), 'Solana')
  assert.equal(solanaClusterName(`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1:${addr}`), 'Solana Devnet')
})

test('solanaClusterName never guesses: EVM, unknown and malformed ids give null', () => {
  assert.equal(solanaClusterName('eip155:1:0x1234567890abcdef1234567890abcdef12345678'), null)
  assert.equal(solanaClusterName('solana:unknowngenesis:abc'), null)
  assert.equal(solanaClusterName('solana'), null)
  assert.equal(solanaClusterName(undefined), null)
})

test('CAIP address → verification: Devnet verified, Mainnet-Beta mismatch, anything unreadable unverified', () => {
  const addr = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
  assert.equal(verifySolanaNetwork(solanaClusterName(`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1:${addr}`)).status, 'verified')
  const main = verifySolanaNetwork(solanaClusterName(`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${addr}`))
  assert.equal(main.status, 'mismatch')
  assert.equal(main.reportedName, 'Solana Mainnet-Beta')
  assert.equal(verifySolanaNetwork(solanaClusterName(undefined)).status, 'unverified')
  assert.equal(verifySolanaNetwork(solanaClusterName(`solana:unknowngenesis:${addr}`)).status, 'unverified')
})
