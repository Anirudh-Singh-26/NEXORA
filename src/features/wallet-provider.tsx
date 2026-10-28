import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, useAccount } from 'wagmi'
import { useAppKit, useAppKitAccount, useAppKitEvents, useAppKitNetwork, useAppKitState, useAppKitTheme, useDisconnect, useWalletInfo } from '@reown/appkit/react'
import { classifyConnectError, connectRequestReducer, IDLE_CONNECT_REQUEST } from '@/lib/wallet/connect-request'
import { isSolanaAddress, solanaClusterName } from '@/lib/wallet/solana-cluster'
import { wagmiConfig, isWalletConfigured, APPKIT_CONNECT_NETWORK } from '@/lib/wallet/config'
import { useSolanaExternalSync } from '@/features/wallet/use-solana-external-sync'
import { WalletSetupDialog } from '@/components/layout/wallet-setup-dialog'
import { useUiStore } from '@/store/ui-store'
import { WALLET_NETWORK_CONFIG } from '@/lib/wallet/network-config'

export interface WalletNetwork {
  chainId: number
  name: string
  shortName: string
  nativeCurrency: string
}

/** EVM networks NEXORA's read-only data layer understands. Keep in sync with src/lib/wallet/config.ts. */
export const SUPPORTED_WALLET_NETWORKS: WalletNetwork[] = [
  WALLET_NETWORK_CONFIG.evm.ethereum,
  WALLET_NETWORK_CONFIG.evm.sepolia,
  WALLET_NETWORK_CONFIG.evm.polygon,
  WALLET_NETWORK_CONFIG.evm.base,
  WALLET_NETWORK_CONFIG.evm.arbitrum,
  WALLET_NETWORK_CONFIG.evm.optimism,
  WALLET_NETWORK_CONFIG.evm.linea,
].map((network) => ({
  chainId: network.chainId,
  name: network.name,
  shortName: network.shortName,
  nativeCurrency: network.nativeCurrency.symbol,
}))

export type WalletEcosystem = 'evm' | 'solana'
export type WalletStatus = 'unavailable' | 'disconnected' | 'connecting' | 'connected'

export interface WalletAccount {
  ecosystem: WalletEcosystem
  address: string
  /** Wallet brand as reported by the connector (e.g. "MetaMask", "Phantom"); null when it did not report one. */
  walletName: string | null
}

export interface WalletContextValue {
  /** 'unavailable' means wallet connections are not configured (missing VITE_REOWN_PROJECT_ID). */
  status: WalletStatus
  /** True when VITE_REOWN_PROJECT_ID is set and the connection modal can work. */
  isAvailable: boolean
  /** Generic pending state: a connect request (any ecosystem) or a session restore is in progress and nothing is connected yet. */
  isConnecting: boolean
  /** Pending state of an EVM-specific / Solana-specific connect request (or that namespace's session restore). Independent of each other and of TON/TRON. */
  isEvmConnecting: boolean
  isSolanaConnecting: boolean
  /** True only while wagmi / AppKit silently restore a stored session for that namespace (not a user-initiated connect). */
  isEvmRestoring: boolean
  isSolanaRestoring: boolean
  /** The active account's ecosystem. EVM and Solana addresses are never interchangeable. */
  ecosystem: WalletEcosystem | null
  /** Address of the active account (EVM 0x… or Solana base58). Use evmAddress for EVM-only data. */
  address: string | null
  providerName: string | null
  /** Connected EVM account, if any. Existing read-only balance/token code uses these two. */
  evmAddress: string | null
  /** ACTUAL chain ID reported by the connected EVM provider (wagmi); null while unreadable. Never assumed from a target network. */
  chainId: number | null
  evmWalletName: string | null
  network: WalletNetwork | null
  /** True when an EVM chain ID was read from the wallet but is not in SUPPORTED_WALLET_NETWORKS. */
  isUnsupportedNetwork: boolean
  /** Connected Solana account, if any. */
  solanaAddress: string | null
  solanaWalletName: string | null
  /**
   * ACTUAL cluster of the Solana session, from the Solana account's own CAIP address (AppKit's Solana adapter). Null when it is not a
   * recognised cluster. This is never derived from a target selection; compare it with the supported Devnet via
   * verifySolanaNetwork(). Solana wallets do not expose their cluster to sites, so this is the adapter's session network.
   */
  solanaNetworkName: string | null
  accounts: WalletAccount[]
  error: string | null
  /**
   * Opens Reown's wallet modal. Reown has ONE shared modal and session manager for EVM and Solana, so this cannot run two
   * connections in parallel. With an ecosystem it opens the modal's Connect view asking for that namespace (`eip155` / `solana`);
   * that option is passed through to AppKit and, if this AppKit build ignores it, the generic wallet list is shown instead.
   * Either way "connected" is only ever concluded from that ecosystem's own account (evmAddress / solanaAddress), never from
   * the modal opening or from the other ecosystem. Without an ecosystem (or when it is already connected) it opens the default view.
   */
  connect: (ecosystem?: WalletEcosystem) => Promise<void>
  /**
   * Convenience entry points for one namespace. They never disconnect anything themselves: the previously active wallet is
   * disconnected by ActiveWalletCoordinator only AFTER the new one has authorized, so a rejected request keeps the old wallet.
   */
  connectEvm: () => Promise<void>
  connectSolana: () => Promise<void>
  /**
   * Disconnects through the wallet library (not just a local flag). With an ecosystem it asks AppKit to disconnect only that
   * namespace (`eip155` / `solana`), leaving the other ecosystem's account untouched; with none it disconnects every Reown
   * wallet. TON and TRON have their own providers and are never touched here. Calls are serialised: one at a time.
   */
  disconnect: (ecosystem?: WalletEcosystem) => Promise<void>
  disconnectEvm: () => Promise<void>
  disconnectSolana: () => Promise<void>
  /** Which disconnect is in flight: one ecosystem, 'all', or null. Cleared on success and on failure. */
  disconnectingEcosystem: WalletEcosystem | 'all' | null
  clearError: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/

const UNAVAILABLE: WalletContextValue = {
  status: 'unavailable', isAvailable: false, isConnecting: false, isEvmConnecting: false, isSolanaConnecting: false, isEvmRestoring: false, isSolanaRestoring: false, ecosystem: null, address: null, providerName: null,
  evmAddress: null, chainId: null, evmWalletName: null, network: null, isUnsupportedNetwork: false,
  solanaAddress: null, solanaWalletName: null, solanaNetworkName: null, accounts: [], error: null,
  connect: async () => undefined, connectEvm: async () => undefined, connectSolana: async () => undefined, disconnect: async () => undefined, disconnectEvm: async () => undefined, disconnectSolana: async () => undefined, disconnectingEcosystem: null, clearError: () => undefined,
}

const queryClient = new QueryClient()

/**
 * Single source of wallet state for the app. Wallet discovery, connection, account/network events and the modal are
 * owned by Reown AppKit (EVM via wagmi, Solana via the Reown Solana adapter); this provider only adapts that state to
 * NEXORA's `useWallet()` shape so existing read-only balance code is unchanged. It never signs or sends anything.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  if (!isWalletConfigured || !wagmiConfig) return <UnconfiguredWalletProvider>{children}</UnconfiguredWalletProvider>
  return <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}><ConnectedWalletProvider>{children}</ConnectedWalletProvider></QueryClientProvider>
  </WagmiProvider>
}

function UnconfiguredWalletProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo<WalletContextValue>(() => ({ ...UNAVAILABLE, connect: async () => setOpen(true) }), [])
  return <WalletContext.Provider value={value}>{children}<WalletSetupDialog open={open} onOpenChange={setOpen} /></WalletContext.Provider>
}

function ConnectedWalletProvider({ children }: { children: ReactNode }) {
  const { open } = useAppKit()
  const { switchNetwork } = useAppKitNetwork()
  // `switchNetwork` is re-created on every render; read the latest one through a ref so `connect` keeps a stable dependency list.
  const switchNetworkRef = useRef(switchNetwork)
  useEffect(() => { switchNetworkRef.current = switchNetwork })
  const { disconnect: disconnectAll } = useDisconnect()
  const { activeChain, open: modalOpen } = useAppKitState()
  const evm = useAccount()
  const solAccount = useAppKitAccount({ namespace: 'solana' })
  const evmInfo = useWalletInfo('eip155').walletInfo
  const solInfo = useWalletInfo('solana').walletInfo
  const { setThemeMode } = useAppKitTheme()
  const theme = useUiStore((state) => state.theme)
  const [error, setError] = useState<string | null>(null)
  const inAppDisconnect = useRef(false)
  const [disconnectingEcosystem, setDisconnectingEcosystem] = useState<WalletEcosystem | 'all' | null>(null)
  const disconnectInFlight = useRef(false)
  // A connect attempt is pending only while NEXORA's own request is alive. Each request gets an id so a stale one can never
  // clear a newer one; wagmi/AppKit keep reporting 'connecting' if the wallet prompt is dismissed, so they do not drive this.
  const [request, dispatchRequest] = useReducer(connectRequestReducer, IDLE_CONNECT_REQUEST)
  const nextRequestId = useRef(0)
  const activeRequestId = useRef<number | null>(null)
  const wasModalOpen = useRef(false)
  // Which ecosystem the pending request was started for (null for a generic request). Mirrored in a ref for the callbacks.
  const [pendingEcosystem, setPendingEcosystem] = useState<WalletEcosystem | null>(null)
  const pendingEcosystemRef = useRef<WalletEcosystem | null>(null)
  const appKitEvent = useAppKitEvents()

  // Keep the AppKit modal in the same theme as the rest of NEXORA.
  useEffect(() => { setThemeMode(theme) }, [theme, setThemeMode])

  const evmAddress = evm.status === 'connected' && evm.address && EVM_ADDRESS.test(evm.address) ? evm.address : null
  // Solana is connected only when ITS OWN namespace reports a valid Solana public key; an EVM address can never qualify.
  const appKitSolanaAddress = solAccount.isConnected && isSolanaAddress(solAccount.address) ? solAccount.address : null
  // Follows external Solana disconnects/account switches that AppKit's Solana adapter does not forward (see the hook).
  const solanaAddress = useSolanaExternalSync(appKitSolanaAddress, inAppDisconnect, setError)
  const chainId = evmAddress && typeof evm.chainId === 'number' ? evm.chainId : null
  const network = useMemo(() => SUPPORTED_WALLET_NETWORKS.find((item) => item.chainId === chainId) ?? null, [chainId])
  // EVM name: wagmi's own connector first (it belongs to the EVM account); AppKit's per-namespace info only as a fallback.
  const evmWalletName = evmAddress ? (evm.connector?.name ?? evmInfo?.name ?? null) : null
  // Solana name: only AppKit's Solana-namespace info, and never when it merely repeats the EVM wallet's name while both
  // ecosystems are connected (AppKit can report the globally active wallet there, so it is not reliably Solana's).
  const solInfoName = solInfo?.name ?? null
  const solanaWalletName = solanaAddress && solInfoName && !(evmAddress && solInfoName === evmWalletName) ? solInfoName : null
  const ecosystem: WalletEcosystem | null = evmAddress && solanaAddress ? (activeChain === 'solana' ? 'solana' : 'evm') : evmAddress ? 'evm' : solanaAddress ? 'solana' : null
  const address = ecosystem === 'solana' ? solanaAddress : ecosystem === 'evm' ? evmAddress : null
  const providerName = ecosystem === 'solana' ? solanaWalletName : ecosystem === 'evm' ? evmWalletName : null
  // Ends whatever request is pending (success, dismissal, rejection or failure) so no loading state can outlive it.
  const endRequest = useCallback(() => {
    activeRequestId.current = null
    pendingEcosystemRef.current = null
    setPendingEcosystem(null)
    dispatchRequest({ type: 'close' })
  }, [])

  // Closing the connect modal without a connection (dismissed, cancelled, rejected) ends the pending request.
  useEffect(() => {
    if (wasModalOpen.current && !modalOpen) endRequest()
    wasModalOpen.current = modalOpen
  }, [modalOpen, endRequest])

  // A request is satisfied only by ITS OWN ecosystem's account appearing; the other ecosystem connecting does not settle it.
  useEffect(() => {
    if ((pendingEcosystem === 'evm' && evmAddress) || (pendingEcosystem === 'solana' && solanaAddress)) endRequest()
  }, [pendingEcosystem, evmAddress, solanaAddress, endRequest])

  // A failed or rejected connection reported by AppKit ends the pending request and is explained instead of hanging.
  useEffect(() => {
    const data = appKitEvent?.data
    // AppKit can keep the last event available across renders. Handle it only while a NEXORA
    // connect request is active; otherwise endRequest/setError can trigger a render loop.
    if (data?.event !== 'CONNECT_ERROR' || activeRequestId.current === null) return
    activeRequestId.current = null
    endRequest()
    setError(classifyConnectError((data.properties as { message?: unknown } | undefined)?.message).message)
  }, [appKitEvent, endRequest])

  // 'connecting' comes from NEXORA's own pending request (cleared on close/failure) or a session restore. wagmi's/AppKit's
  // 'connecting' status and AppKit's global `loading` flag can stay true after a dismissed prompt, so they are not used.
  const isConnecting = !address && (request.current !== null || evm.status === 'reconnecting' || solAccount.status === 'reconnecting')
  // Per-ecosystem pending: only a request started FOR that ecosystem (or its own session restore) counts, never another's.
  const requestPending = request.current !== null
  const isEvmConnecting = !evmAddress && ((requestPending && pendingEcosystem === 'evm') || evm.status === 'reconnecting')
  const isSolanaConnecting = !solanaAddress && ((requestPending && pendingEcosystem === 'solana') || solAccount.status === 'reconnecting')
  const isEvmRestoring = !evmAddress && evm.status === 'reconnecting'
  const isSolanaRestoring = !solanaAddress && solAccount.status === 'reconnecting'
  const status: WalletStatus = address ? 'connected' : isConnecting ? 'connecting' : 'disconnected'
  // The Solana account's own cluster (from its CAIP address), independent of which ecosystem is currently active.
  const solanaNetworkName = solanaAddress ? solanaClusterName(solAccount.caipAddress) : null

  const connect = useCallback(async (target?: WalletEcosystem) => {
    const ecosystem: WalletEcosystem | null = target === 'evm' || target === 'solana' ? target : null
    setError(null)
    // One-active-wallet policy: the previous wallet (any ecosystem) is NOT touched here. It is disconnected by
    // ActiveWalletCoordinator only after this request authorizes, so a rejected or failed request keeps the current connection.
    // That ecosystem is already connected: open AppKit's default (account) view rather than a second connect flow.
    if ((ecosystem === 'evm' && evmAddress) || (ecosystem === 'solana' && solanaAddress)) {
      try { await open() } catch { setError('Could not open the wallet modal. Reload the page and try again.') }
      return
    }
    // A request for the same ecosystem is already pending on the shared modal: do not stack a duplicate.
    if (activeRequestId.current !== null && pendingEcosystemRef.current === ecosystem) return
    const id = ++nextRequestId.current
    activeRequestId.current = id
    pendingEcosystemRef.current = ecosystem
    setPendingEcosystem(ecosystem)
    dispatchRequest({ type: 'begin', id })
    try {
      // AppKit 1.8.24 resolves the connector for the wallet the user picks from ITS ACTIVE CHAIN (w3m-connector-list.onClickWallet,
      // ConnectorController.selectWalletConnector), not from the modal's `namespace` filter. The active chain starts as Ethereum
      // (defaultNetwork: Sepolia), and `open({ namespace })` only moves it through an asynchronous SwitchNetwork view. Make the
      // requested namespace AppKit's active chain first, so the Solana button can never end up running the Ethereum connector.
      // This only changes which namespace is active; it prompts nothing and never touches the other wallet's session.
      if (ecosystem !== null) await switchNetworkRef.current(ecosystem === 'solana' ? APPKIT_CONNECT_NETWORK.solana : APPKIT_CONNECT_NETWORK.evm)
      await open(ecosystem === null ? undefined : ({ view: 'Connect', namespace: ecosystem === 'solana' ? 'solana' : 'eip155' } as Parameters<typeof open>[0]))
    } catch (openError) {
      // Only the request that is still current may clear itself or report an error.
      if (activeRequestId.current !== id) return
      endRequest()
      const info = classifyConnectError(openError)
      setError(info.kind === 'other' ? 'Could not open the wallet modal. Reload the page and try again.' : info.message)
    }
  }, [open, evmAddress, solanaAddress, endRequest])
  const disconnect = useCallback(async (target?: WalletEcosystem) => {
    const ecosystem: WalletEcosystem | null = target === 'evm' || target === 'solana' ? target : null
    if (disconnectInFlight.current) return
    disconnectInFlight.current = true
    setError(null)
    setDisconnectingEcosystem(ecosystem ?? 'all')
    // Only a Solana-affecting disconnect may be mistaken for an external Solana disconnect by the Wallet Standard listener.
    if (ecosystem !== 'evm') inAppDisconnect.current = true
    try {
      // Same namespace-scoped call use-solana-external-sync.ts already makes ({ namespace: 'solana' }); 'eip155' is the EVM namespace id.
      await disconnectAll(ecosystem === null ? undefined : { namespace: ecosystem === 'solana' ? 'solana' : 'eip155' })
    } catch {
      setError(ecosystem === null
        ? 'Could not disconnect the wallet. Disconnect from the wallet app itself if it stays connected.'
        : `Could not disconnect the ${ecosystem === 'solana' ? 'Solana' : 'Ethereum'} wallet. Disconnect from the wallet app itself if it stays connected.`)
    } finally {
      inAppDisconnect.current = false
      disconnectInFlight.current = false
      setDisconnectingEcosystem(null)
    }
  }, [disconnectAll])
  const connectEvm = useCallback(() => connect('evm'), [connect])
  const connectSolana = useCallback(() => connect('solana'), [connect])
  const disconnectEvm = useCallback(() => disconnect('evm'), [disconnect])
  const disconnectSolana = useCallback(() => disconnect('solana'), [disconnect])
  const clearError = useCallback(() => setError(null), [])

  const accounts = useMemo<WalletAccount[]>(() => [
    ...(evmAddress ? [{ ecosystem: 'evm' as const, address: evmAddress, walletName: evmWalletName }] : []),
    ...(solanaAddress ? [{ ecosystem: 'solana' as const, address: solanaAddress, walletName: solanaWalletName }] : []),
  ], [evmAddress, evmWalletName, solanaAddress, solanaWalletName])

  const value = useMemo<WalletContextValue>(() => ({
    status, isAvailable: true, isConnecting, isEvmConnecting, isSolanaConnecting, isEvmRestoring, isSolanaRestoring, ecosystem, address, providerName, evmAddress, chainId, evmWalletName, network,
    isUnsupportedNetwork: evmAddress !== null && chainId !== null && network === null,
    solanaAddress, solanaWalletName, solanaNetworkName, accounts, error, connect, connectEvm, connectSolana, disconnect, disconnectEvm, disconnectSolana, disconnectingEcosystem, clearError,
  }), [status, isConnecting, isEvmConnecting, isSolanaConnecting, isEvmRestoring, isSolanaRestoring, ecosystem, address, providerName, evmAddress, chainId, evmWalletName, network, solanaAddress, solanaWalletName, solanaNetworkName, accounts, error, connect, connectEvm, connectSolana, disconnect, disconnectEvm, disconnectSolana, disconnectingEcosystem, clearError])

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext)
  if (!value) throw new Error('useWallet must be used inside WalletProvider')
  return value
}
