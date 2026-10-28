import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, CircleAlert, LoaderCircle, LogOut, Wallet, X } from 'lucide-react'
import { SUPPORTED_WALLET_NETWORKS, useWallet } from '@/features/wallet-provider'

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function WalletConnectButton() {
  const wallet = useWallet()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const showingSolana = wallet.ecosystem === 'solana'
  const unsupportedNetwork = !showingSolana && wallet.isUnsupportedNetwork
  const networkText = showingSolana
    ? (wallet.solanaNetworkName ?? 'Solana network unavailable')
    : (wallet.network?.name ?? (unsupportedNetwork ? `Unsupported network (chain ${wallet.chainId})` : 'Detecting network…'))

  return <div className="nx-wallet-control" ref={rootRef}>
    <button
      type="button"
      className={`nx-wallet-button ${wallet.address ? 'is-connected' : ''}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen((value) => !value)}
      title={wallet.address ? `Connected wallet ${wallet.address}` : 'Connect a browser wallet'}
    >
      {wallet.address ? <span className="nx-wallet-status-dot" aria-hidden="true" /> : <Wallet size={15} aria-hidden="true" />}
      <span>{wallet.address ? shortenAddress(wallet.address) : 'Connect Wallet'}</span>
      <ChevronDown size={13} aria-hidden="true" className={`nx-wallet-chevron ${open ? 'is-open' : ''}`} />
    </button>

    {open && <section className="nx-wallet-panel" role="dialog" aria-label="Wallet connection">
      <div className="nx-wallet-panel__header">
        <div>
          <p className="nx-wallet-eyebrow">NEXORA IDENTITY</p>
          <h2>{wallet.address ? 'Wallet connected' : 'Connect a wallet'}</h2>
        </div>
        <button type="button" className="nx-wallet-close" aria-label="Close wallet panel" onClick={() => setOpen(false)}><X size={16} /></button>
      </div>

      {wallet.address ? <>
        <div className="nx-wallet-account">
          <span className="nx-wallet-account__icon"><Wallet size={17} /></span>
          <div className="nx-wallet-account__copy">
            <strong>{wallet.providerName ?? 'Browser wallet'}</strong>
            <span title={wallet.address}>{shortenAddress(wallet.address)}</span>
          </div>
          <span className="nx-wallet-connected-check" title="Connected"><Check size={14} /></span>
        </div>
        <div className={`nx-wallet-network ${unsupportedNetwork ? 'is-warning' : ''}`}>
          <span className="nx-wallet-network__dot" />
          <div>
            <small>ACTIVE NETWORK</small>
            <strong>{networkText}</strong>
          </div>
        </div>
        {unsupportedNetwork && <p className="nx-wallet-note"><CircleAlert size={14} /> NEXORA's initial wallet features are optimized for supported networks. Switch networks in your wallet to continue.</p>}
        <button type="button" className="nx-wallet-secondary" onClick={() => { wallet.disconnect(); setOpen(false) }}><LogOut size={14} /> Disconnect from NEXORA</button>
        <p className="nx-wallet-footnote">This disconnects the NEXORA session only. Manage extension permissions in your wallet.</p>
      </> : <>
        <p className="nx-wallet-description">Connect a browser wallet to unlock wallet-aware features. You can keep exploring NEXORA without connecting.</p>
        {/* Never disabled while connecting: wallet.connect() only opens the modal, and a connection state that is stuck must not lock out a manual retry. */}
        <button type="button" className="nx-wallet-primary" onClick={() => void wallet.connect()} aria-busy={wallet.isConnecting}>
          {wallet.isConnecting ? <LoaderCircle size={16} className="nx-wallet-spinner" /> : <Wallet size={16} />}
          {wallet.isConnecting ? 'Waiting for wallet…' : 'Connect browser wallet'}
        </button>
        {!wallet.isAvailable && <p className="nx-wallet-footnote">Wallet connections are not configured for this build (missing VITE_REOWN_PROJECT_ID). Clicking Connect explains how to enable them.</p>}
        <div className="nx-wallet-supported">
          <span>NETWORKS RECOGNIZED</span>
          <div>{SUPPORTED_WALLET_NETWORKS.map((network) => <span key={network.chainId}>{network.shortName}</span>)}</div>
        </div>
      </>}

      {wallet.error && <div className="nx-wallet-error" role="alert"><CircleAlert size={15} /><span>{wallet.error}</span><button type="button" aria-label="Dismiss error" onClick={wallet.clearError}><X size={13} /></button></div>}
      <p className="nx-wallet-footnote nx-wallet-security">NEXORA never asks for your seed phrase or private key. Connecting does not sign a transaction.</p>
    </section>}
  </div>
}
