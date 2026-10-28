import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { TonConnectUIProvider, useIsConnectionRestored, useTonAddress, useTonConnectModal, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react'
import { classifyTonChain, evaluateTonBalanceGate, type TonBalanceGate, type TonNetworkIdentity } from '@/lib/ton/chain'
import { describeTonConnectError } from '@/lib/ton/errors'
import { pickTonWalletName } from '@/lib/ton/wallet-info'

/**
 * TON wallet state, deliberately separate from `useWallet()` (EVM + Solana via Reown AppKit) and from the TRON
 * provider: TON addresses and network values are never merged into those types.
 * Nothing here signs or sends anything (transactions are a later batch): it connects, reads the account and
 * identifies the network the WALLET reports.
 */

export type TonConnectionStatus = 'restoring' | 'disconnected' | 'connecting' | 'connected' | 'disconnecting'

export interface TonWalletState {
  status: TonConnectionStatus
  walletName: string | null
  /** Raw `<workchain>:<hex>` address, only while connected. */
  rawAddress: string | null
  /** User-friendly (non-bounceable) address as formatted by TON Connect for the connected network, only while connected. */
  friendlyAddress: string | null
  network: TonNetworkIdentity | null
  /** True only for a connected wallet that positively reported TON testnet. */
  onTestnet: boolean
  /** Decides whether a testnet balance request may be made. */
  balanceGate: TonBalanceGate
  error: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  clearError: () => void
}

const TonWalletContext = createContext<TonWalletState | null>(null)

export function useTonWalletState(): TonWalletState {
  const value = useContext(TonWalletContext)
  if (!value) throw new Error('useTonWalletState must be used inside <TonProvider>.')
  return value
}

function TonStateProvider({ children }: { children: ReactNode }) {
  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet()
  const restored = useIsConnectionRestored()
  const friendly = useTonAddress(true)
  const modal = useTonConnectModal() // read for `modal.state` only; its `open`/`close` are unstable and must not be used
  const [error, setError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  // Connection failures (for example a rejected request) are delivered through the status-change error callback.
  useEffect(() => tonConnectUI.onStatusChange(() => setError(null), (connectError) => setError(describeTonConnectError(connectError))), [tonConnectUI])

  const rawAddress = wallet ? wallet.account.address : null
  const chain = wallet ? String(wallet.account.chain) : null
  const network = useMemo(() => (wallet ? classifyTonChain(chain) : null), [wallet, chain])
  const balanceGate = useMemo(() => evaluateTonBalanceGate({ restored, chain, address: rawAddress }), [restored, chain, rawAddress])

  // `useTonConnectModal().open` is a NEW function on every render (the library returns inline closures), so depending on it
  // made `connect`, the context value and everything derived from it change on every render. Call the stable
  // `tonConnectUI.modal.open` directly instead; `tonConnectUI` is a single instance for the provider's lifetime.
  const connect = useCallback(async () => {
    setError(null)
    try {
      await tonConnectUI.modal.open()
    } catch (openError) {
      setError(describeTonConnectError(openError))
    }
  }, [tonConnectUI])

  const disconnect = useCallback(async () => {
    setError(null)
    setDisconnecting(true)
    try {
      await tonConnectUI.disconnect()
    } catch (disconnectError) {
      setError(describeTonConnectError(disconnectError))
    } finally {
      setDisconnecting(false)
    }
  }, [tonConnectUI])

  const state: TonWalletState = useMemo(() => {
    const status: TonConnectionStatus = !restored ? 'restoring' : disconnecting ? 'disconnecting' : wallet ? 'connected' : modal.state?.status === 'opened' ? 'connecting' : 'disconnected'
    const connected = status === 'connected' || status === 'disconnecting'
    return {
      status,
      walletName: pickTonWalletName(wallet),
      rawAddress: connected ? rawAddress : null,
      friendlyAddress: connected && friendly !== '' ? friendly : null,
      network: connected ? network : null,
      onTestnet: status === 'connected' && network?.verifiedTestnet === true,
      balanceGate,
      error,
      connect,
      disconnect,
      clearError: () => setError(null),
    }
  }, [restored, disconnecting, wallet, modal.state?.status, rawAddress, friendly, network, balanceGate, error, connect, disconnect])

  return <TonWalletContext.Provider value={state}>{children}</TonWalletContext.Provider>
}

/**
 * Mounted only inside the lazily loaded TON section of /wallet (see ton-wallet-slot.tsx), so TON Connect's
 * wallet-list and session-restore requests happen only for visitors who open that page, never app-wide.
 */
export function TonProvider({ manifestUrl, children }: { manifestUrl: string; children: ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <TonStateProvider>{children}</TonStateProvider>
    </TonConnectUIProvider>
  )
}
