import test from 'node:test'
import assert from 'node:assert/strict'
import { WALLET_NETWORK_CONFIG, WALLET_TESTNETS } from './network-config.ts'

test('canonical wallet testnet registry has the expected network identifiers and public endpoints', () => {
  assert.equal(WALLET_TESTNETS.evm.chainId, 11155111)
  assert.equal(WALLET_TESTNETS.solana.networkId, 'devnet')
  assert.equal(WALLET_TESTNETS.ton.chainId, '-3')
  assert.equal(WALLET_TESTNETS.tron.chainId, '0x94a9059e')
  assert.equal(WALLET_TESTNETS.evm.explorerUrl, 'https://sepolia.etherscan.io')
  assert.equal(WALLET_TESTNETS.solana.publicRpcUrl, 'https://api.devnet.solana.com')
  assert.equal(WALLET_TESTNETS.ton.apiBaseUrl, 'https://testnet.toncenter.com/api/v2')
  assert.equal(WALLET_TESTNETS.tron.apiBaseUrl, 'https://api.shasta.trongrid.io')
})

test('provider slugs and explorers are centrally declared for data layers', () => {
  assert.equal(WALLET_NETWORK_CONFIG.evm.sepolia.alchemySlug, 'eth-sepolia')
  assert.equal(WALLET_NETWORK_CONFIG.evm.linea.chainId, 59144)
  assert.equal(WALLET_NETWORK_CONFIG.providers.openSeaWebUrl, 'https://opensea.io')
  assert.equal(WALLET_NETWORK_CONFIG.providers.alchemyRpcHostSuffix, '.g.alchemy.com/v2')
})
