import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WALLET_NETWORKS,
  networkFor,
  verifyEvmNetwork,
  verifySolanaNetwork,
  verifyTonNetwork,
  verifyTronNetwork,
  explorerTxUrl,
  explorerAddressUrl,
} from './environments.ts'

test('WALLET_NETWORKS defines exactly one supported test network for each of the 4 ecosystems', () => {
  const ecosystems = ['evm', 'solana', 'ton', 'tron'] as const
  assert.deepEqual(Object.keys(WALLET_NETWORKS).sort(), [...ecosystems].sort())
  for (const eco of ecosystems) {
    const desc = networkFor(eco)
    assert.ok(desc.label, `label exists for ${eco}`)
    assert.ok(desc.fullName, `fullName exists for ${eco}`)
    assert.ok(desc.explorerUrl, `explorerUrl exists for ${eco}`)
    assert.ok(desc.nativeCurrency, `nativeCurrency exists for ${eco}`)
    assert.notEqual(desc.networkId, undefined, `networkId defined for ${eco}`)
    assert.ok(!/mainnet/i.test(`${desc.label} ${desc.fullName}`), `${eco} target is never a mainnet`)
  }
})

test('correct network identifiers: Sepolia, Devnet, TON Testnet, TRON Shasta', () => {
  assert.equal(networkFor('evm').networkId, 11155111)
  assert.equal(networkFor('solana').networkId, 'devnet')
  assert.equal(networkFor('ton').networkId, '-3')
  assert.equal(networkFor('tron').networkId, '0x94a9059e')
})

test('verifyEvmNetwork: Sepolia verified; mainnet and other chains are mismatches; unknown stays unverified', () => {
  const sepOk = verifyEvmNetwork(11155111)
  assert.equal(sepOk.status, 'verified')
  assert.equal(sepOk.isReady, true)
  assert.equal(sepOk.reportedName, 'Sepolia')

  // Mainnet is a mismatch, named as what it really is, with guidance to switch to Sepolia.
  const ethMismatch = verifyEvmNetwork(1)
  assert.equal(ethMismatch.status, 'mismatch')
  assert.equal(ethMismatch.isReady, false)
  assert.equal(ethMismatch.reportedName, 'Ethereum Mainnet')
  assert.match(ethMismatch.message ?? '', /Switch your wallet to Sepolia/i)
  assert.match(ethMismatch.message ?? '', /will not switch it for you/i)

  // Other supported-by-AppKit mainnets and unknown chain IDs are mismatches too, never verified.
  assert.equal(verifyEvmNetwork(8453).status, 'mismatch')
  const unknownChain = verifyEvmNetwork(99999)
  assert.equal(unknownChain.status, 'mismatch')
  assert.equal(unknownChain.reportedName, 'Unsupported chain 99999')

  // Null chainId -> unverified, never a guess.
  const unv = verifyEvmNetwork(null)
  assert.equal(unv.status, 'unverified')
  assert.equal(unv.isReady, false)
})

test('verifySolanaNetwork: Devnet verified; mainnet and testnet clusters are mismatches; unknown stays unverified', () => {
  const devOk = verifySolanaNetwork('Solana Devnet')
  assert.equal(devOk.status, 'verified')
  assert.equal(devOk.isReady, true)
  assert.equal(verifySolanaNetwork('devnet').status, 'verified')

  // AppKit's own name for Solana mainnet is exactly "Solana": a mismatch, named as Mainnet-Beta.
  const solMain = verifySolanaNetwork('Solana')
  assert.equal(solMain.status, 'mismatch')
  assert.equal(solMain.isReady, false)
  assert.equal(solMain.reportedName, 'Solana Mainnet-Beta')
  assert.match(solMain.message ?? '', /Switch your wallet to Devnet/i)
  assert.equal(verifySolanaNetwork('mainnet-beta').status, 'mismatch')

  // Solana Testnet is a different cluster from Devnet, so it is never labelled as the supported network.
  const solTestnet = verifySolanaNetwork('Solana Testnet')
  assert.equal(solTestnet.status, 'mismatch')
  assert.equal(solTestnet.reportedName, 'Solana Testnet')

  // Null or unrecognised -> unverified.
  assert.equal(verifySolanaNetwork(null).status, 'unverified')
  assert.equal(verifySolanaNetwork('Some Other Cluster').status, 'unverified')
})

test('verifyTonNetwork: testnet is verified, mainnet is a mismatch', () => {
  assert.equal(verifyTonNetwork('-3', 'testnet').status, 'verified')
  assert.equal(verifyTonNetwork('-3', 'testnet').isReady, true)

  // Testnet chain only (no kind): chain is authoritative.
  assert.equal(verifyTonNetwork('-3').status, 'verified')
  assert.equal(verifyTonNetwork('-3', null).status, 'verified')
  assert.equal(verifyTonNetwork('-3', undefined).status, 'verified')

  // Mainnet chain (with or without a consistent kind) -> mismatch with switch guidance.
  const mMismatch = verifyTonNetwork('-239', 'mainnet')
  assert.equal(mMismatch.status, 'mismatch')
  assert.equal(mMismatch.isReady, false)
  assert.equal(mMismatch.reportedName, 'TON Mainnet')
  assert.match(mMismatch.message ?? '', /Switch your wallet to Testnet/i)
  assert.equal(verifyTonNetwork('-239').status, 'mismatch')
  assert.equal(verifyTonNetwork('-239', null).status, 'mismatch')
})

test('verifyTonNetwork: contradictory chain+kind pairs → unverified (never verified or mismatch)', () => {
  const c1 = verifyTonNetwork('-3', 'mainnet')
  assert.equal(c1.status, 'unverified')
  assert.equal(c1.isReady, false)
  assert.match(c1.message ?? '', /contradictory/i)

  const c2 = verifyTonNetwork('-239', 'testnet')
  assert.equal(c2.status, 'unverified')
  assert.equal(c2.isReady, false)
  assert.match(c2.message ?? '', /contradictory/i)
})

test('verifyTonNetwork: missing or unknown chain/kind → unverified', () => {
  assert.equal(verifyTonNetwork(null).status, 'unverified')
  assert.equal(verifyTonNetwork(null, 'testnet').status, 'unverified')
  assert.equal(verifyTonNetwork('-3', 'unknown').status, 'unverified')
  assert.equal(verifyTonNetwork('-239', 'unknown').status, 'unverified')
  assert.equal(verifyTonNetwork('-4', 'testnet').status, 'unverified')
  assert.equal(verifyTonNetwork('0', 'mainnet').status, 'unverified')
  assert.equal(verifyTonNetwork('-4').status, 'unverified')
})

test('verifyTronNetwork: Shasta verified; mainnet and Nile are mismatches; unknown stays unverified', () => {
  const shastaOk = verifyTronNetwork({ kind: 'shasta', chainId: '0x94a9059e', verifiedShasta: true })
  assert.equal(shastaOk.status, 'verified')
  assert.equal(shastaOk.isReady, true)

  const mainMismatch = verifyTronNetwork({ kind: 'mainnet', chainId: '0x2b6653dc', verifiedShasta: false })
  assert.equal(mainMismatch.status, 'mismatch')
  assert.equal(mainMismatch.isReady, false)
  assert.equal(mainMismatch.reportedName, 'TRON Mainnet')
  assert.match(mainMismatch.message ?? '', /Switch TronLink to Shasta/i)

  // Nile is a different testnet: wrong network, never labelled Shasta.
  const nile = verifyTronNetwork({ kind: 'nile', chainId: '0xcd8690dc', verifiedShasta: false })
  assert.equal(nile.status, 'mismatch')
  assert.equal(nile.reportedName, 'TRON Nile Testnet')

  assert.equal(verifyTronNetwork({ kind: 'unknown' }).status, 'unverified')
  assert.equal(verifyTronNetwork(null).status, 'unverified')
})

test('explorerTxUrl: returns the testnet explorer URL for each ecosystem', () => {
  const hash = '0x123abc'
  assert.equal(explorerTxUrl('evm', hash), 'https://sepolia.etherscan.io/tx/0x123abc')
  assert.equal(explorerTxUrl('solana', hash), 'https://explorer.solana.com/tx/0x123abc?cluster=devnet')
  assert.equal(explorerTxUrl('ton', hash), 'https://testnet.tonscan.org/transaction/0x123abc')
  assert.equal(explorerTxUrl('tron', hash), 'https://shasta.tronscan.org/#/transaction/0x123abc')
  assert.equal(explorerTxUrl('evm', ''), null)
})

test('explorerAddressUrl: returns the testnet explorer URL for each ecosystem', () => {
  const addr = '0xabc'
  assert.equal(explorerAddressUrl('evm', addr), 'https://sepolia.etherscan.io/address/0xabc')
  assert.equal(explorerAddressUrl('solana', addr), 'https://explorer.solana.com/address/0xabc?cluster=devnet')
  assert.equal(explorerAddressUrl('ton', addr), 'https://testnet.tonscan.org/address/0xabc')
  assert.equal(explorerAddressUrl('tron', addr), 'https://shasta.tronscan.org/#/address/0xabc')
  assert.equal(explorerAddressUrl('evm', ''), null)
})
