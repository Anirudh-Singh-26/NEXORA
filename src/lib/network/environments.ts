import { WALLET_TESTNETS, WALLET_NETWORK_CONFIG } from '../wallet/network-config.ts'

/**
 * Wallet network registry and verifiers. The Wallet page is TESTNET-ONLY: this module describes the one supported
 * test network per ecosystem and verifies what a connected wallet ACTUALLY reports against it. There is no environment
 * selector and no mainnet target. A wallet that reports a mainnet (or any other unsupported) network is classified as a
 * mismatch and named by the network it is really on; it is never labelled as the supported testnet.
 *
 * Identifiers are taken from the ecosystem's own authoritative constants:
 *   EVM:     SEPOLIA_CHAIN_ID (11155111)       — from lib/network/testnet.ts
 *   Solana:  'devnet'                           — Solana cluster string per lib/network/testnet.ts
 *   TON:     '-3'                               — TON Connect CHAIN enum per lib/ton/chain.ts
 *   TRON:    '0x94a9059e'                       — genesis-derived ID per lib/tron/network.ts
 *
 * No React, no browser globals. Nothing here signs, sends or switches a wallet's network.
 */

export type WalletEcosystemKey = 'evm' | 'solana' | 'ton' | 'tron'

export interface EcosystemNetworkDescriptor {
  /** Human-readable short label, e.g. "Sepolia", "Devnet", "Testnet", "Shasta". */
  label: string
  /** Longer display name, e.g. "Sepolia Testnet". */
  fullName: string
  /** Block explorer base URL for this network. */
  explorerUrl: string
  /** Native currency symbol. */
  nativeCurrency: string
  /**
   * The authoritative network identity this ecosystem supports. Deliberately typed as unknown to avoid coupling
   * ecosystem-specific types; callers compare against their own constants.
   *
   * - EVM: number (chain ID)
   * - Solana: string (cluster: 'devnet')
   * - TON: string (CHAIN value: '-3')
   * - TRON: string (genesis-derived chain ID: '0x94a9059e')
   */
  networkId: unknown
}

/** The single supported test network per ecosystem. */
export const WALLET_NETWORKS: Readonly<Record<WalletEcosystemKey, EcosystemNetworkDescriptor>> = {
  evm: {
    label: 'Sepolia',
    fullName: 'Sepolia Testnet',
    explorerUrl: WALLET_TESTNETS.evm.explorerUrl,
    nativeCurrency: WALLET_TESTNETS.evm.nativeCurrency.symbol,
    networkId: WALLET_TESTNETS.evm.chainId,
  },
  solana: {
    label: 'Devnet',
    fullName: 'Solana Devnet',
    explorerUrl: WALLET_TESTNETS.solana.explorerUrl,
    nativeCurrency: 'SOL',
    networkId: WALLET_TESTNETS.solana.networkId,
  },
  ton: {
    label: 'Testnet',
    fullName: 'TON Testnet',
    explorerUrl: WALLET_TESTNETS.ton.explorerUrl,
    nativeCurrency: WALLET_TESTNETS.ton.nativeCurrency.symbol,
    networkId: WALLET_TESTNETS.ton.chainId,
  },
  tron: {
    label: 'Shasta',
    fullName: 'TRON Shasta Testnet',
    explorerUrl: WALLET_TESTNETS.tron.explorerUrl,
    nativeCurrency: 'TRX',
    networkId: WALLET_TESTNETS.tron.chainId,
  },
} as const

/** Convenience: the supported test network of an ecosystem. */
export function networkFor(ecosystem: WalletEcosystemKey): EcosystemNetworkDescriptor {
  return WALLET_NETWORKS[ecosystem]
}

export type VerificationStatus = 'verified' | 'mismatch' | 'unverified'

export interface NetworkVerificationResult {
  status: VerificationStatus
  target: EcosystemNetworkDescriptor
  /** The network the wallet ACTUALLY reported (never the supported target unless it really is that network). */
  reportedName: string | null
  message: string | null
  isReady: boolean
}

/** Display names of the EVM chains NEXORA recognises (mirrors SUPPORTED_WALLET_NETWORKS in wallet-provider.tsx). */
const EVM_CHAIN_NAMES: Readonly<Record<number, string>> = Object.fromEntries(
  Object.values(WALLET_NETWORK_CONFIG.evm).filter((network) => 'chainId' in network).map((network) => [network.chainId, network.name]),
) as Record<number, string>

/** Pill text for a connected wallet: only a positively verified network reads "Connected"; unknown is never called a mismatch. */
export function networkStatusLabel(status: VerificationStatus): string {
  return status === 'verified' ? 'Connected' : status === 'unverified' ? 'Network unverified' : 'Network mismatch'
}

export function verifyEvmNetwork(chainId: number | null): NetworkVerificationResult {
  const target = networkFor('evm')
  if (chainId === null) {
    return { status: 'unverified', target, reportedName: null, message: 'Your wallet did not report its EVM network.', isReady: false }
  }
  const targetId = target.networkId as number
  if (chainId === targetId) {
    return { status: 'verified', target, reportedName: target.label, message: null, isReady: true }
  }
  // The ACTUAL chain reported by the wallet, named from the supported list; anything else is shown by its raw chain ID.
  const actualName = EVM_CHAIN_NAMES[chainId] ?? `Unsupported chain ${chainId}`
  return {
    status: 'mismatch',
    target,
    reportedName: actualName,
    message: `Your wallet is connected to ${actualName}. NEXORA's Wallet page works on ${target.fullName} only. Switch your wallet to ${target.label} yourself; NEXORA will not switch it for you.`,
    isReady: false,
  }
}

export function verifySolanaNetwork(clusterOrName: string | null): NetworkVerificationResult {
  const target = networkFor('solana')
  if (!clusterOrName) {
    return { status: 'unverified', target, reportedName: null, message: 'Your wallet did not report its Solana network.', isReady: false }
  }
  const lower = clusterOrName.toLowerCase()
  // Classify what the adapter reported. AppKit names Solana mainnet exactly "Solana" (the same convention solana-balance.ts uses).
  const actual = lower.includes('devnet') ? 'devnet' : lower.includes('testnet') ? 'testnet' : lower.includes('mainnet') || lower === 'solana' ? 'mainnet' : null
  if (actual === null) {
    return { status: 'unverified', target, reportedName: null, message: `NEXORA could not identify the Solana network "${clusterOrName}".`, isReady: false }
  }
  if (actual === 'devnet') {
    return { status: 'verified', target, reportedName: 'Devnet', message: null, isReady: true }
  }
  const actualName = actual === 'testnet' ? 'Solana Testnet' : 'Solana Mainnet-Beta'
  return {
    status: 'mismatch',
    target,
    reportedName: actualName,
    message: `Your wallet is connected to ${actualName}. NEXORA's Wallet page works on ${target.fullName} only. Switch your wallet to Devnet yourself (in the wallet's own network/developer settings), then disconnect Solana here and connect again so the new network is picked up. NEXORA will not switch it for you.`,
    isReady: false,
  }
}

export function verifyTonNetwork(chain: string | null, kind?: string | null): NetworkVerificationResult {
  const target = networkFor('ton')
  if (!chain || kind === 'unknown') {
    return { status: 'unverified', target, reportedName: 'Unknown network', message: 'NEXORA could not identify this TON network.', isReady: false }
  }
  // Reject contradictory combinations: chain and kind must agree when both are present.
  // '-3' is Testnet; '-239' is Mainnet. Any disagreement between chain and kind is a contradiction.
  const chainIsTestnet = chain === '-3'
  const chainIsMainnet = chain === '-239'
  const kindIsTestnet = kind === 'testnet'
  const kindIsMainnet = kind === 'mainnet'
  const kindPresent = kind != null && kind !== ''
  if (kindPresent && ((chainIsTestnet && kindIsMainnet) || (chainIsMainnet && kindIsTestnet))) {
    return {
      status: 'unverified', target, reportedName: 'Ambiguous network',
      message: 'Your wallet reported contradictory TON network information. Reconnect and check your wallet settings.',
      isReady: false,
    }
  }
  // chain is the authoritative signal; kind (when present and consistent) adds confidence but is not required.
  if (chainIsTestnet) return { status: 'verified', target, reportedName: 'Testnet', message: null, isReady: true }
  if (chainIsMainnet) {
    return { status: 'mismatch', target, reportedName: 'TON Mainnet', message: `Your wallet is connected to TON Mainnet. NEXORA's Wallet page works on ${target.fullName} only. Switch your wallet to Testnet in its own settings, then reconnect.`, isReady: false }
  }
  // Unknown chain ID not in the known set.
  return { status: 'unverified', target, reportedName: 'Unknown network', message: `NEXORA could not identify TON chain "${chain}".`, isReady: false }
}

export function verifyTronNetwork(
  identity: { kind: string; chainId?: string | null; verifiedShasta?: boolean } | null,
): NetworkVerificationResult {
  const target = networkFor('tron')
  if (!identity || identity.kind === 'unknown') {
    return { status: 'unverified', target, reportedName: 'Unknown network', message: 'NEXORA could not identify this TRON network.', isReady: false }
  }
  if (identity.verifiedShasta || identity.kind === 'shasta' || identity.chainId === '0x94a9059e') {
    return { status: 'verified', target, reportedName: 'Shasta', message: null, isReady: true }
  }
  const actual = identity.kind === 'mainnet' ? 'TRON Mainnet' : identity.kind === 'nile' ? 'TRON Nile Testnet' : null
  if (actual === null) {
    return { status: 'unverified', target, reportedName: 'Unknown network', message: 'NEXORA could not identify this TRON network.', isReady: false }
  }
  return {
    status: 'mismatch',
    target,
    reportedName: actual,
    message: `Your wallet is connected to ${actual}. NEXORA's Wallet page works on ${target.fullName} only. Switch TronLink to Shasta.`,
    isReady: false,
  }
}

/** Network-correct (testnet) transaction explorer URL for an ecosystem. */
export function explorerTxUrl(ecosystem: WalletEcosystemKey, txHashOrSig: string): string | null {
  if (!txHashOrSig || typeof txHashOrSig !== 'string') return null
  const clean = txHashOrSig.trim()
  if (!clean) return null
  const base = networkFor(ecosystem).explorerUrl
  switch (ecosystem) {
    case 'evm':
      return `${base}/tx/${clean}`
    case 'solana':
      return `${base}/tx/${clean}?cluster=devnet`
    case 'ton':
      return `${base}/transaction/${clean}`
    case 'tron':
      return `${base}/#/transaction/${clean}`
  }
}

/** Network-correct (testnet) address explorer URL for an ecosystem. */
export function explorerAddressUrl(ecosystem: WalletEcosystemKey, address: string): string | null {
  if (!address || typeof address !== 'string') return null
  const clean = address.trim()
  if (!clean) return null
  const base = networkFor(ecosystem).explorerUrl
  switch (ecosystem) {
    case 'evm':
      return `${base}/address/${clean}`
    case 'solana':
      return `${base}/address/${clean}?cluster=devnet`
    case 'ton':
      return `${base}/address/${clean}`
    case 'tron':
      return `${base}/#/address/${clean}`
  }
}
