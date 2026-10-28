import { CircleAlert, ExternalLink, LoaderCircle, Power, RefreshCw, ShieldCheck } from 'lucide-react'
import { CopyButton, type CopyController } from '@/features/wallet/wallet-copy'
import { TronSendSection } from '@/features/tron/tron-send-form'
import { useTronWallet } from '@/features/tron/tron-provider'
import { useShastaBalance, type ShastaBalanceView } from '@/features/tron/use-shasta-balance'
import { formatSunAsTrx, shortenTronAddress } from '@/lib/tron/format'
import { SHASTA_API_URL, shastaAddressUrl, TRON_NETWORK_LABEL } from '@/lib/tron/network'
import type { ShastaBalance } from '@/lib/tron/balance'
import '@/styles/tron-wallet.css'

const SHASTA_HOST = new URL(SHASTA_API_URL).host

function timeText(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function groupedSun(sun: bigint): string {
  return sun.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function BalanceFigure({ balance, stale }: { balance: ShastaBalance; stale?: boolean }) {
  return (
    <div className={`tron-figure ${stale ? 'is-stale' : ''}`}>
      <p className="tron-figure__value"><span>{formatSunAsTrx(balance.sun, 2)}</span> <small>TRX</small></p>
      <p className="tron-figure__sub">{groupedSun(balance.sun)} SUN · 1 TRX = 1,000,000 SUN</p>
      {!balance.hasAccountRecord && <p className="tron-figure__note">Shasta has no account record for this address yet (it has not been activated, for example by receiving testnet TRX), so 0 TRX is shown.</p>}
      <p className="tron-figure__note">Read from {SHASTA_HOST} at {timeText(balance.retrievedAt)}{stale ? ' (last successful read)' : ''}. Testnet TRX has no market value.</p>
    </div>
  )
}

function BalanceBlock({ view, onRefresh }: { view: ShastaBalanceView; onRefresh: () => void }) {
  if (view.status === 'idle') return null
  if (view.status === 'loading') {
    return (
      <div aria-busy="true">
        {view.previous ? <BalanceFigure balance={view.previous} stale /> : <span className="wlt-skel wlt-skel--value" role="status" aria-label="Loading Shasta balance" />}
      </div>
    )
  }
  if (view.status === 'error') {
    return (
      <div className="tron-error" role="alert">
        <CircleAlert size={16} aria-hidden="true" />
        <div>
          <strong>Shasta balance unavailable</strong>
          <p>{view.message}</p>
          {view.previous && <BalanceFigure balance={view.previous} stale />}
          <button type="button" className="wlt-btn wlt-btn--sm" onClick={onRefresh}><RefreshCw size={13} aria-hidden="true" />Try again</button>
        </div>
      </div>
    )
  }
  return <BalanceFigure balance={view.balance} />
}

/**
 * TRON (TronLink) connection and read-only Shasta balance, shown on /wallet whether or not an EVM/Solana wallet is connected.
 * It reads the public address and the wallet's network only; nothing is signed or sent.
 */
export function TronWalletPanel({ copy }: { copy: CopyController }) {
  const tron = useTronWallet()
  const { view: balance, refresh } = useShastaBalance(tron.address, tron.onShasta)
  const connected = tron.status === 'connected' && tron.address !== null
  const busy = tron.status === 'connecting' || tron.status === 'disconnecting'
  const network = tron.network

  let chip: { tone: 'ok' | 'warn' | 'idle'; label: string }
  if (!connected) chip = { tone: 'idle', label: 'Not connected' }
  else if (network.status === 'ready') chip = { tone: network.identity.verifiedShasta ? 'ok' : 'warn', label: TRON_NETWORK_LABEL[network.identity.kind] }
  else if (network.status === 'error') chip = { tone: 'warn', label: 'Network unverified' }
  else chip = { tone: 'idle', label: 'Identifying network…' }

  const announcement = connected
    ? network.status === 'ready' ? `TRON wallet connected on ${TRON_NETWORK_LABEL[network.identity.kind]}.` : 'TRON wallet connected. Identifying network.'
    : tron.status === 'connecting' ? 'Waiting for TronLink.' : ''

  return (
    <section id="wlt-tron" className="wlt-section tron-panel" aria-labelledby="tron-title" tabIndex={-1}>
      <div className="wlt-section-head">
        <div>
          <p className="wlt-eyebrow">TRON · Shasta testnet · read-only</p>
          <h2 id="tron-title">TRON wallet</h2>
        </div>
        <span className={`wlt-chip is-${chip.tone === 'ok' ? 'ok' : chip.tone === 'warn' ? 'warn' : 'idle'}`}><i aria-hidden="true" />{chip.label}</span>
      </div>
      <p className="wlt-sr" role="status" aria-live="polite">{announcement}</p>

      {tron.error && (
        <div className="tron-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <div><p>{tron.error}</p><button type="button" className="wlt-link" onClick={tron.clearError}>Dismiss</button></div>
        </div>
      )}

      {!connected && (
        <div className="tron-body">
          <p className="wlt-copy-text">Connect TronLink using the <strong>Connect Wallet</strong> menu above to see your TRON address and balance. This is separate from your Ethereum, Solana and TON connections, which keep working as before. NEXORA only reads your public address; it never asks you to sign or send anything here.</p>
          {tron.availability === 'not-installed' ? (
            <p className="wlt-warn"><CircleAlert size={14} aria-hidden="true" /><span>TronLink was not detected in this browser. {tron.walletUrl && <a className="wlt-link" href={tron.walletUrl} target="_blank" rel="noopener noreferrer">Get TronLink<ExternalLink size={12} aria-hidden="true" /></a>} Reload this page after installing or unlocking it.</span></p>
          ) : null}
        </div>
      )}

      {connected && tron.address && (
        <div className="tron-body">
          <div className="tron-row">
            <span className="tron-label">{tron.walletName ?? 'TRON wallet'} account</span>
            <div className="wlt-address">
              <code title={tron.address}>{shortenTronAddress(tron.address, 8, 6)}</code>
              <CopyButton address={tron.address} copy={copy} label="TRON account" />
              {tron.onShasta && <a className="wlt-link" href={shastaAddressUrl(tron.address)} target="_blank" rel="noopener noreferrer">Shasta explorer<ExternalLink size={12} aria-hidden="true" /></a>}
            </div>
          </div>

          {network.status === 'loading' && <p className="wlt-copy-text" role="status"><LoaderCircle className="wlt-spin tron-inline" size={14} aria-hidden="true" />Reading the network from your wallet…</p>}

          {network.status === 'error' && (
            <div className="tron-error" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              <div><strong>Network not verified</strong><p>{network.message} No balance is shown until the network is positively identified as Shasta.</p>
                <button type="button" className="wlt-btn wlt-btn--sm" onClick={tron.refreshNetwork}><RefreshCw size={13} aria-hidden="true" />Re-check network</button></div>
            </div>
          )}

          {network.status === 'ready' && !network.identity.verifiedShasta && (
            <div className="tron-error is-warn" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              <div>
                <strong>{network.identity.kind === 'mainnet' ? 'TronLink is on TRON Mainnet' : network.identity.kind === 'nile' ? 'TronLink is on the Nile testnet' : 'NEXORA could not identify this TRON network'}</strong>
                <p>
                  {network.identity.kind === 'unknown'
                    ? `The wallet reported ${network.identity.inconsistent ? 'a network label that disagrees with its chain ID' : network.identity.chainId ? `chain ID ${network.identity.chainId}` : 'no chain ID'}, which NEXORA does not treat as Shasta. `
                    : ''}
                  This milestone supports the Shasta testnet only, so no balance is read and Shasta-only actions are disabled. NEXORA can ask TronLink to switch; if it cannot, open TronLink, choose <em>Shasta Testnet</em>, then re-check.
                </p>
                <div className="wlt-actions">
                  <button type="button" className="wlt-btn wlt-btn--sm wlt-btn--primary" onClick={() => void tron.switchToShasta()} disabled={tron.switching} aria-busy={tron.switching}>
                    {tron.switching ? <LoaderCircle className="wlt-spin" size={13} aria-hidden="true" /> : null}{tron.switching ? 'Asking TronLink…' : 'Switch to Shasta'}
                  </button>
                  <button type="button" className="wlt-btn wlt-btn--sm" onClick={tron.refreshNetwork}><RefreshCw size={13} aria-hidden="true" />Re-check network</button>
                </div>
              </div>
            </div>
          )}

          {tron.onShasta && (
            <div className="tron-row">
              <span className="tron-label">Native balance · Shasta</span>
              <BalanceBlock view={balance} onRefresh={refresh} />
              <div className="wlt-actions">
                <button type="button" className="wlt-btn wlt-btn--sm" onClick={refresh} disabled={balance.status === 'loading'} aria-busy={balance.status === 'loading'}>
                  <RefreshCw size={13} className={balance.status === 'loading' ? 'wlt-spin' : ''} aria-hidden="true" />Refresh balance
                </button>
              </div>
            </div>
          )}

          {/* Stays mounted while connected so an already-broadcast transfer keeps being tracked; the form itself appears only on verified Shasta. */}
          <TronSendSection key={tron.address} sender={tron.address} balance={balance} onRefreshBalance={refresh} copy={copy} />

          <div className="wlt-actions tron-foot">
            <button type="button" className="wlt-btn wlt-btn--quiet wlt-btn--sm" onClick={() => void tron.disconnect()} disabled={busy}><Power size={13} aria-hidden="true" />Disconnect TRON</button>
          </div>
          <p className="wlt-note"><ShieldCheck size={13} aria-hidden="true" /><span>Disconnecting clears NEXORA’s TRON session only; TronLink may still list this site as authorised, which you can revoke inside the wallet. Balances come from one public Shasta node and are not independently verified.</span></p>
        </div>
      )}
    </section>
  )
}
