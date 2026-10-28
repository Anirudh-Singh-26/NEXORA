import { useCallback } from 'react'
import { groupDecimal } from '@/lib/blockchain'
import { useWallet } from '@/features/wallet-provider'
import { useNativeBalance } from '@/hooks/use-native-balance'
import { useSolanaBalance } from '@/hooks/use-solana-balance'
import { useWalletNfts } from '@/hooks/use-wallet-nfts'
import { useWalletTokens } from '@/hooks/use-wallet-tokens'
import { verifyEvmNetwork, verifySolanaNetwork } from '@/lib/network/environments'

/**
 * How trustworthy / complete one data source currently is. Kept deliberately fine-grained so the UI can tell
 * "nothing found" (empty) apart from "could not be read" (unavailable) and "not requested" (idle / unsupported).
 */
export type SourceStatus = 'idle' | 'loading' | 'live' | 'stale' | 'empty' | 'unavailable' | 'unsupported'

export const SOURCE_LABEL: Record<SourceStatus, string> = {
  idle: 'Not requested',
  loading: 'Loading',
  live: 'Live',
  stale: 'Stale',
  empty: 'None found',
  unavailable: 'Unavailable',
  unsupported: 'Not supported',
}

export interface NativeView {
  ecosystem: 'evm' | 'solana'
  symbol: string
  networkName: string
  status: SourceStatus
  /** Grouped decimal amount without the symbol; null whenever the real balance is not known (never faked as 0). */
  display: string | null
  /** True only when the provider reported an exact zero balance. */
  isZero: boolean
  /** The balance is non-zero but smaller than the display precision. */
  belowPrecision: boolean
  loading: boolean
  error: { message: string; retryable: boolean } | null
  /** Plain-language explanation for idle/unsupported states. */
  note: string | null
  /** Short provenance line (source and age) when the read succeeded. */
  provenance: string | null
  refresh: () => void
}

export interface CountView {
  status: SourceStatus
  /** Number of items loaded so far; null when unknown. */
  count: number | null
  /** More pages exist, so `count` is a lower bound. */
  more: boolean
}

function clock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function listStatus(ready: boolean, loaded: boolean, loading: boolean, hasError: boolean, count: number): SourceStatus {
  if (!ready) return 'idle'
  if (loaded) return hasError ? 'stale' : count === 0 ? 'empty' : 'live'
  if (hasError && !loading) return 'unavailable'
  return 'loading'
}

/**
 * The single place the Wallets page reads data. It only composes the project's existing read-only hooks
 * (native balance, SOL balance, ERC-20 tokens, NFTs) so every section shares one request per source and one
 * account/network key: switching account or network can never leave another wallet's data on screen.
 */
export function useWalletPortfolio() {
  const wallet = useWallet()
  // The Wallet page is testnet-only. Data is requested for an account only when its wallet ACTUALLY reports the supported
  // test network (Sepolia / Solana Devnet); a mainnet, another network or an unreported one makes no request at all.
  // The wallet's real network is never rewritten: a wrong network stays a mismatch and is explained below.
  const evmVerification = verifyEvmNetwork(wallet.chainId)
  const solVerification = verifySolanaNetwork(wallet.solanaNetworkName)
  const evmReadAddress = evmVerification.status === 'verified' ? wallet.evmAddress : null
  const solReadAddress = solVerification.status === 'verified' ? wallet.solanaAddress : null
  const evmBalance = useNativeBalance(evmReadAddress, wallet.chainId)
  const solBalance = useSolanaBalance(solReadAddress, wallet.solanaNetworkName)
  const tokens = useWalletTokens(evmReadAddress, wallet.chainId)
  const nfts = useWalletNfts(evmReadAddress, wallet.chainId)

  let evmNative: NativeView | null = null
  const bt = evmBalance.target
  if (bt.kind === 'ready') {
    const ok = evmBalance.result?.status === 'ok' ? evmBalance.result : null
    const failed = evmBalance.result?.status === 'unavailable' ? evmBalance.result : null
    evmNative = {
      ecosystem: 'evm',
      symbol: ok?.data.symbol ?? bt.chain.nativeSymbol,
      networkName: bt.chain.name,
      status: ok ? (ok.provenance.stale ? 'stale' : 'live') : failed && !evmBalance.loading ? 'unavailable' : 'loading',
      display: ok ? groupDecimal(ok.data.balanceFormatted) : null,
      isZero: ok ? ok.data.balanceWei === '0' : false,
      belowPrecision: ok ? ok.data.balanceWei !== '0' && ok.data.balanceFormatted === '0' : false,
      loading: evmBalance.loading,
      error: failed && !evmBalance.loading ? { message: failed.error.message, retryable: failed.error.retryable } : null,
      note: null,
      provenance: ok ? `${ok.provenance.networkName} · ${ok.provenance.stale ? 'stale, refresh failed' : ok.provenance.fromCache ? 'cached' : 'fetched'} ${clock(ok.provenance.retrievedAt)}` : null,
      refresh: evmBalance.refresh,
    }
  } else if (wallet.evmAddress !== null && evmVerification.status !== 'verified') {
    // Connected, but not on the supported test network: nothing was requested. Say so with the real network name.
    evmNative = {
      ecosystem: 'evm', symbol: wallet.network?.nativeCurrency ?? 'ETH', networkName: evmVerification.reportedName ?? 'Unknown network',
      status: 'unsupported', display: null, isZero: false, belowPrecision: false,
      loading: false, error: null, note: evmVerification.message, provenance: null, refresh: evmBalance.refresh,
    }
  } else if (bt.kind !== 'no-wallet') {
    const note = bt.kind === 'invalid-address' ? 'The wallet returned an address NEXORA cannot read. Reconnect and try again.'
      : bt.kind === 'unknown-network' ? 'The active network could not be read from your wallet, so no balance was requested.'
      : `NEXORA has no data source for chain ${bt.chainId}. Switch networks in your wallet; NEXORA will not switch for you.`
    evmNative = {
      ecosystem: 'evm', symbol: wallet.network?.nativeCurrency ?? 'ETH', networkName: wallet.network?.name ?? 'Unknown network',
      status: bt.kind === 'invalid-address' ? 'unavailable' : 'unsupported', display: null, isZero: false, belowPrecision: false,
      loading: false, error: null, note, provenance: null, refresh: evmBalance.refresh,
    }
  }

  let solNative: NativeView | null = null
  if (solBalance.target.kind === 'ready') {
    const { balance, error, loading } = solBalance
    solNative = {
      ecosystem: 'solana', symbol: 'SOL', networkName: solBalance.target.networkName,
      status: balance ? (error ? 'stale' : 'live') : error ? 'unavailable' : 'loading',
      display: balance ? balance.display : null,
      isZero: balance ? balance.lamports === '0' : false,
      belowPrecision: false,
      loading,
      error: error ? { message: error.message, retryable: error.retryable } : null,
      note: null,
      provenance: balance ? `${solBalance.target.networkName} · read via NEXORA server` : null,
      refresh: solBalance.refresh,
    }
  } else if (wallet.solanaAddress !== null && solVerification.status !== 'verified') {
    // Connected, but not on Solana Devnet: nothing was requested. Say so with the real network name.
    solNative = {
      ecosystem: 'solana', symbol: 'SOL', networkName: solVerification.reportedName ?? 'Unknown network',
      status: 'unsupported', display: null, isZero: false, belowPrecision: false,
      loading: false, error: null, note: solVerification.message, provenance: null, refresh: solBalance.refresh,
    }
  } else if (solBalance.target.kind === 'unsupported-network') {
    solNative = {
      ecosystem: 'solana', symbol: 'SOL', networkName: solBalance.target.networkName,
      status: 'unsupported', display: null, isZero: false, belowPrecision: false,
      loading: false, error: null,
      note: solBalance.target.reason,
      provenance: null, refresh: solBalance.refresh,
    }
  } else if (solBalance.target.kind === 'unknown-network') {
    solNative = {
      ecosystem: 'solana', symbol: 'SOL', networkName: 'Solana',
      status: 'unsupported', display: null, isZero: false, belowPrecision: false,
      loading: false, error: null,
      note: 'Your wallet did not report its Solana network. Reconnect or switch to Devnet in your wallet settings.',
      provenance: null, refresh: solBalance.refresh,
    }
  } else if (solBalance.target.kind === 'invalid-address') {
    solNative = {
      ecosystem: 'solana', symbol: 'SOL', networkName: 'Solana', status: 'unavailable', display: null, isZero: false, belowPrecision: false,
      loading: false, error: null, note: 'The wallet returned a Solana address NEXORA cannot read. Reconnect and try again.', provenance: null, refresh: solBalance.refresh,
    }
  }

  const evmReady = tokens.target.kind === 'ready'
  const tokenView: CountView = {
    status: wallet.evmAddress && !evmReady ? (tokens.target.kind === 'invalid-address' ? 'unavailable' : 'unsupported') : listStatus(evmReady, tokens.loaded, tokens.loading, tokens.error !== null, tokens.tokens.length),
    count: tokens.loaded ? tokens.tokens.length : null,
    more: tokens.nextPageKey !== null,
  }
  const nftReady = nfts.target.kind === 'ready'
  const nftView: CountView = {
    status: wallet.evmAddress && !nftReady ? (nfts.target.kind === 'invalid-address' ? 'unavailable' : 'unsupported') : listStatus(nftReady, nfts.loaded, nfts.loading, nfts.error !== null, nfts.nfts.length),
    count: nfts.loaded ? nfts.nfts.length : null,
    more: nfts.nextPageKey !== null,
  }

  const refreshEvm = evmBalance.refresh
  const refreshSol = solBalance.refresh
  const refreshTokens = tokens.refresh
  const refreshNfts = nfts.refresh

  const refreshAll = useCallback(() => {
    refreshEvm()
    refreshSol()
    refreshTokens()
    refreshNfts()
  }, [refreshEvm, refreshSol, refreshTokens, refreshNfts])

  const refreshing = Boolean(evmNative?.loading || solNative?.loading || tokens.loading || nfts.loading)

  /** Every EVM source finished successfully and found nothing: the only case a "fresh wallet" message is honest. */
  const evmFreshWallet = Boolean(evmNative && evmNative.status === 'live' && evmNative.isZero && tokenView.status === 'empty' && nftView.status === 'empty')

  return { wallet, evmBalance, solBalance, tokens, nfts, evmNative, solNative, tokenView, nftView, refreshAll, refreshing, evmFreshWallet, evmVerification, solVerification }
}

export type WalletPortfolio = ReturnType<typeof useWalletPortfolio>
