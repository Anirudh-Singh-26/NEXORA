import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AdapterState, type Transaction, type WalletError } from '@tronweb3/tronwallet-abstract-adapter'
import { WalletProvider as TronAdapterProvider, useWallet as useTronAdapterWallet } from '@tronweb3/tronwallet-adapter-react-hooks'
import { TronLinkAdapter, TronLinkAdapterName } from '@tronweb3/tronwallet-adapter-tronlink'
import { classifyTronNetwork, type TronNetworkIdentity } from '@/lib/tron/network'
import { evaluateSendGate, TransferError, type TronTx } from '@/lib/tron/transfer'

/**
 * TRON wallet state, deliberately separate from `useWallet()` (EVM + Solana via Reown AppKit).
 * Nothing here signs or sends anything: it connects, reads the address and identifies the network.
 */

export type TronAvailability = 'checking' | 'available' | 'not-installed'
export type TronConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting'

export type TronNetworkView =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; identity: TronNetworkIdentity; networkType: string; checkedAt: number }
  | { status: 'error'; message: string }

export interface TronWalletState {
  availability: TronAvailability
  status: TronConnectionStatus
  walletName: string | null
  walletUrl: string | null
  /** Base58 address, only while connected. */
  address: string | null
  network: TronNetworkView
  /** True only for a connected wallet whose chain ID was positively identified as Shasta. */
  onShasta: boolean
  error: string | null
  switching: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  /** Asks the wallet to switch to Shasta. Rejects/explains when the wallet cannot do it programmatically. */
  switchToShasta: () => Promise<void>
  /**
   * Re-reads the wallet's network and account RIGHT NOW and, only if the wallet is the expected account on verified
   * Shasta, asks it to sign the already-verified transaction. Never broadcasts. Throws TransferError otherwise.
   */
  signShastaTransfer: (unsigned: TronTx, expectedSender: string) => Promise<TronTx>
  refreshNetwork: () => void
  clearError: () => void
}

const TronWalletContext = createContext<TronWalletState | null>(null)

export function useTronWallet(): TronWalletState {
  const value = useContext(TronWalletContext)
  if (!value) throw new Error('useTronWallet must be used inside <TronProvider>.')
  return value
}

/** Shasta chain ID as used by TronLink's switch-chain request (see @tronweb3/tronwallet-adapter-tronlink docs). */
const SHASTA_SWITCH_CHAIN_ID = '0x94a9059e'

const IDLE_NETWORK: TronNetworkView = { status: 'idle' }
const LOADING_NETWORK: TronNetworkView = { status: 'loading' }

export function describeTronError(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  switch (name) {
    case 'WalletNotFoundError':
      return 'TronLink was not found in this browser. Install or unlock TronLink, then try again.'
    case 'WalletSwitchChainError':
      return 'TronLink could not switch networks from here. Switch to Shasta inside the wallet, then press Re-check network.'
    case 'WalletConnectionError':
      return `TronLink did not complete the connection${message ? `: ${message.slice(0, 140)}` : ''}. The request may have been rejected or the wallet may be locked.`
    default:
      return message ? message.slice(0, 180) : 'The TRON wallet reported an error.'
  }
}

function ignoreAdapterProviderError(): void {
  // Errors are surfaced through the adapter's own "error" event in <TronStateProvider>, so the provider's
  // default console.error handler is replaced with this stable no-op.
}

interface NetworkSlot { key: string; view: TronNetworkView }

function TronStateProvider({ children }: { children: ReactNode }) {
  const { wallets, wallet, address, connected, connecting, disconnecting, select, connect: adapterConnect, disconnect: adapterDisconnect } = useTronAdapterWallet()
  const [error, setError] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)
  const [slot, setSlot] = useState<NetworkSlot | null>(null)
  const [recheck, setRecheck] = useState(0)

  // network() exists on the TronLink adapter (not on the generic Adapter type); this app configures only TronLink.
  const selected = connected && address ? wallet?.adapter ?? null : null
  const adapter = selected instanceof TronLinkAdapter ? selected : null
  const configured = wallets[0] ?? null
  const key = adapter && address ? `${adapter.name}:${address}` : null

  // Subscribe to adapter errors (connect rejections, wallet-not-found, switch failures). Cleaned up with the adapter.
  const listenAdapter = wallet?.adapter ?? null
  useEffect(() => {
    if (!listenAdapter) return
    const onError = (adapterError: WalletError) => {
      // Network read failures are shown in the network row itself.
      // Signing failures are reported by the send flow itself, next to the form.
      if (adapterError.name === 'WalletGetNetworkError' || adapterError.name === 'WalletSignTransactionError') return
      setError(describeTronError(adapterError))
    }
    listenAdapter.on('error', onError)
    return () => { listenAdapter.off('error', onError) }
  }, [listenAdapter])

  // Identify the network from the wallet itself (genesis-derived chain ID) and re-identify on every relevant event.
  useEffect(() => {
    if (!adapter || !key) return
    let disposed = false
    let sequence = 0
    const read = async (silent: boolean) => {
      const mine = ++sequence
      if (!silent) setSlot({ key, view: LOADING_NETWORK })
      try {
        const info = await adapter.network()
        if (disposed || mine !== sequence) return
        setSlot({ key, view: { status: 'ready', identity: classifyTronNetwork({ chainId: info.chainId, networkType: info.networkType }), networkType: String(info.networkType), checkedAt: Date.now() } })
      } catch (readError) {
        if (disposed || mine !== sequence) return
        setSlot({ key, view: { status: 'error', message: readError instanceof Error && readError.message ? `Could not read the wallet's network: ${readError.message.slice(0, 140)}` : 'Could not read the wallet’s network.' } })
      }
    }
    void read(false)
    const onChanged = () => { void read(false) }
    const onFocus = () => { if (document.visibilityState === 'visible') void read(true) }
    adapter.on('chainChanged', onChanged)
    adapter.on('accountsChanged', onChanged)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      disposed = true
      adapter.off('chainChanged', onChanged)
      adapter.off('accountsChanged', onChanged)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [adapter, key, recheck])

  const network: TronNetworkView = !key ? IDLE_NETWORK : slot && slot.key === key ? slot.view : LOADING_NETWORK

  const connect = useCallback(async () => {
    setError(null)
    if (!wallet) {
      // Selecting the adapter triggers the provider's auto-connect for a manually selected wallet.
      select(TronLinkAdapterName)
      return
    }
    try {
      await adapterConnect()
    } catch (connectError) {
      setError(describeTronError(connectError))
    }
  }, [wallet, select, adapterConnect])

  const disconnect = useCallback(async () => {
    setError(null)
    try {
      await adapterDisconnect()
    } catch (disconnectError) {
      setError(describeTronError(disconnectError))
    }
  }, [adapterDisconnect])

  const switchToShasta = useCallback(async () => {
    if (!adapter) return
    setError(null)
    setSwitching(true)
    try {
      await adapter.switchChain(SHASTA_SWITCH_CHAIN_ID)
      setRecheck((n) => n + 1)
    } catch (switchError) {
      setError(describeTronError(switchError))
    } finally {
      setSwitching(false)
    }
  }, [adapter])

  const signShastaTransfer = useCallback(async (unsigned: TronTx, expectedSender: string): Promise<TronTx> => {
    if (!adapter) throw new TransferError('wallet', 'Connect TronLink first.')
    let info: Awaited<ReturnType<typeof adapter.network>>
    try {
      info = await adapter.network()
    } catch {
      throw new TransferError('wallet', 'Could not verify the wallet’s network, so nothing was signed.')
    }
    const gate = evaluateSendGate({ connected: adapter.connected, address: adapter.address, expectedSender, identity: classifyTronNetwork({ chainId: info.chainId, networkType: info.networkType }) })
    if (!gate.ok) throw new TransferError('wallet', gate.message)
    try {
      // The adapter's Transaction type comes from tronweb; the object was built and byte-verified by transfer.ts.
      return (await adapter.signTransaction(unsigned as unknown as Transaction)) as unknown as TronTx
    } catch (signError) {
      const message = signError instanceof Error ? signError.message : String(signError)
      if (/declin|reject|denied|cancel/i.test(message)) throw new TransferError('declined', 'You declined the request in TronLink. Nothing was sent.')
      throw new TransferError('wallet', `TronLink could not sign the transaction${message ? `: ${message.slice(0, 140)}` : ''}.`)
    }
  }, [adapter])

  const state: TronWalletState = useMemo(() => {
    const availability: TronAvailability = !configured || configured.state === AdapterState.Loading ? 'checking' : configured.state === AdapterState.NotFound ? 'not-installed' : 'available'
    const status: TronConnectionStatus = disconnecting ? 'disconnecting' : connecting ? 'connecting' : connected && address ? 'connected' : 'disconnected'
    return {
      availability,
      status,
      walletName: configured?.adapter.name ?? null,
      walletUrl: configured?.adapter.url ?? null,
      address: status === 'connected' ? address : null,
      network,
      onShasta: status === 'connected' && network.status === 'ready' && network.identity.verifiedShasta,
      error,
      switching,
      connect,
      disconnect,
      switchToShasta,
      signShastaTransfer,
      refreshNetwork: () => setRecheck((n) => n + 1),
      clearError: () => setError(null),
    }
  }, [configured, connecting, disconnecting, connected, address, network, error, switching, connect, disconnect, switchToShasta, signShastaTransfer])

  return <TronWalletContext.Provider value={state}>{children}</TronWalletContext.Provider>
}

/** Mount once near the app root (see App.tsx). The adapter list is created once per mount. */
export function TronProvider({ children }: { children: ReactNode }) {
  const adapters = useMemo(() => [new TronLinkAdapter({ openUrlWhenWalletNotFound: false, openAppWithDeeplink: false, checkTimeout: 3000, securityOptions: { enabled: false } })], [])
  return (
    <TronAdapterProvider
      adapters={adapters}
      autoConnect
      // No wallet popup on page load: connecting starts from a user action, then auto-connect completes it.
      disableAutoConnectOnLoad
      localStorageKey="nexora.tron.adapter"
      onError={ignoreAdapterProviderError}
    >
      <TronStateProvider>{children}</TronStateProvider>
    </TronAdapterProvider>
  )
}
