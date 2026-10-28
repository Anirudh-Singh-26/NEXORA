import type { WalletContextValue, WalletEcosystem } from '@/features/wallet-provider'
import { verifyEvmNetwork, verifySolanaNetwork } from '@/lib/network/environments'
import { identityHues } from '@/lib/wallet/orb-model'

export const ECOSYSTEM_LABEL: Record<WalletEcosystem, string> = { evm: 'EVM', solana: 'Solana' }

export function shortenAddress(address: string, head = 6, tail = 4): string {
  return address.length <= head + tail + 1 ? address : `${address.slice(0, head)}…${address.slice(-tail)}`
}

/** Decorative, deterministic avatar colours derived from the public address. Carries no data. */
export function identityGradient(address: string): string {
  const { a, b } = identityHues(address)
  return `linear-gradient(135deg, hsl(${a} 78% 64%), hsl(${b} 80% 52%))`
}

export type NetworkTone = 'ok' | 'warn' | 'muted'

export interface NetworkDescriptor {
  label: string
  detail: string
  /** Short status word for the pill. */
  status: string
  tone: NetworkTone
}

/**
 * Describes an account's network from the wallet context only (no extra requests). Pass `ecosystem` to describe a specific
 * stage (EVM or Solana) regardless of which account AppKit considers globally active; it defaults to the active one.
 */
export function describeNetwork(wallet: WalletContextValue, ecosystem: WalletEcosystem | null = wallet.ecosystem): NetworkDescriptor {
  const stageAddress = ecosystem === 'solana' ? wallet.solanaAddress : ecosystem === 'evm' ? wallet.evmAddress : null
  if (stageAddress === null) return { label: 'No network', detail: 'Connect a wallet to see its network.', status: 'Disconnected', tone: 'muted' }
  // The Wallet page is testnet-only: only a positively verified test network is a healthy state. The label is always the
  // network the wallet ACTUALLY reports; a mainnet or unsupported network is a warning, never presented as the testnet.
  if (ecosystem === 'solana') {
    const ver = verifySolanaNetwork(wallet.solanaNetworkName)
    if (ver.status === 'verified') {
      return { label: wallet.solanaNetworkName ?? ver.target.fullName, detail: 'Native SOL balance and activity. SPL tokens and NFTs are not supported yet.', status: 'Solana', tone: 'ok' }
    }
    return {
      label: ver.reportedName ?? wallet.solanaNetworkName ?? 'Network unverified',
      detail: ver.message ?? `Switch your wallet to ${ver.target.fullName}.`,
      status: ver.status === 'mismatch' ? 'Mismatch' : 'Unverified',
      tone: 'warn',
    }
  }
  if (wallet.chainId === null) return { label: 'Network unavailable', detail: 'The active network could not be read from your wallet.', status: 'Unknown', tone: 'warn' }
  const ver = verifyEvmNetwork(wallet.chainId)
  if (ver.status !== 'verified') {
    return { label: ver.reportedName ?? `Chain ${wallet.chainId}`, detail: ver.message ?? `Switch your wallet to ${ver.target.fullName}.`, status: 'Mismatch', tone: 'warn' }
  }
  return { label: wallet.network?.name ?? ver.target.fullName, detail: wallet.network ? `${wallet.network.shortName} · native currency ${wallet.network.nativeCurrency}` : `Native currency ${ver.target.nativeCurrency}`, status: 'Detected', tone: 'ok' }
}
