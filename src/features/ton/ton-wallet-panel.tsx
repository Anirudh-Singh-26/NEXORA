import { useCallback, useEffect, useRef } from 'react'
import { CircleAlert, ExternalLink, LoaderCircle, Power, RefreshCw, ShieldCheck } from 'lucide-react'
import { CopyButton, type CopyController } from '@/features/wallet/wallet-copy'
import { TonSectionFrame, type TonChipTone } from '@/features/ton/ton-section-frame'
import { useTonWalletState } from '@/features/ton/ton-provider'
import { TonTransferForm } from '@/features/ton/ton-transfer-form'
import { useTonTestnetBalance } from '@/features/ton/use-ton-testnet-balance'
import type { TonManifestStatus } from '@/features/ton/use-ton-manifest-status'
import { shortenTonAddress, tonTestnetAddressUrl } from '@/lib/ton/address'
import type { TonBalance } from '@/lib/ton/balance'
import type { TonBalanceView } from '@/lib/ton/balance-state'
import { TON_NETWORK_LABEL } from '@/lib/ton/chain'
import { formatNanoTon, formatNanoTonUnits } from '@/lib/ton/format'
import { useReportConnection, useSummary, type SummaryReporter } from '@/features/wallet/wallet-connections'

function timeText(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function BalanceFigure({ balance, host, stale }: { balance: TonBalance; host: string; stale?: boolean }) {
  return (
    <div className={`ton-figure ${stale ? 'is-stale' : ''}`}>
      <p className="ton-figure__value"><span>{formatNanoTon(balance.nano)}</span> <small>TON</small></p>
      <p className="ton-figure__sub">{formatNanoTonUnits(balance.nano)} nanoTON · 1 TON = 1,000,000,000 nanoTON</p>
      {balance.nano === 0n && <p className="ton-figure__note">The testnet data service reports 0 TON for this address, which is also what it returns for an address that has never received testnet TON.</p>}
      <p className="ton-figure__note">Read from {host} at {timeText(balance.retrievedAt)}{stale ? ' (last successful read)' : ''}. Testnet TON has no market value.</p>
    </div>
  )
}

function BalanceBlock({ view, host, onRefresh }: { view: TonBalanceView; host: string; onRefresh: () => void }) {
  if (view.status === 'idle') return null
  if (view.status === 'loading') {
    return (
      <div aria-busy="true">
        {view.previous ? <BalanceFigure balance={view.previous} host={host} stale /> : <span className="wlt-skel wlt-skel--value" role="status" aria-label="Loading TON testnet balance" />}
      </div>
    )
  }
  if (view.status === 'error') {
    return (
      <div className="ton-error" role="alert">
        <CircleAlert size={16} aria-hidden="true" />
        <div>
          <strong>Testnet balance unavailable</strong>
          <p>{view.message}</p>
          {view.previous && <BalanceFigure balance={view.previous} host={host} stale />}
          <button type="button" className="wlt-btn wlt-btn--sm" onClick={onRefresh}><RefreshCw size={13} aria-hidden="true" />Try again</button>
        </div>
      </div>
    )
  }
  return <BalanceFigure balance={view.balance} host={host} />
}

function ManifestNotes({ manifest }: { manifest: TonManifestStatus }) {
  if (manifest.status === 'unavailable') {
    return <div className="ton-error is-warn" role="status"><CircleAlert size={16} aria-hidden="true" /><div><strong>TON Connect manifest not verified</strong><p>{manifest.message} Connecting may fail until <code>/tonconnect-manifest.json</code> is served as valid JSON.</p></div></div>
  }
  if (manifest.status === 'invalid') {
    return <div className="ton-error is-warn" role="status"><CircleAlert size={16} aria-hidden="true" /><div><strong>TON Connect manifest looks incomplete</strong><p>{manifest.problems.join(' ')}</p></div></div>
  }
  if (manifest.status === 'ok' && manifest.originMismatch) {
    return <div className="ton-error is-warn" role="status"><CircleAlert size={16} aria-hidden="true" /><div><strong>Manifest URL differs from this site</strong><p>The manifest’s <code>url</code> does not match this page’s origin. Wallets show that URL to you when you connect; set it to the address this app is served from.</p></div></div>
  }
  return null
}

/**
 * TON (TON Connect) connection and read-only testnet balance, shown on /wallet whether or not an EVM/Solana/TRON
 * wallet is connected. It reads the public account and the network the wallet reports, and hosts the testnet-only
 * native transfer form (signing happens in the wallet through TON Connect).
 */
export function TonWalletPanel({ copy, manifest, apiBase, onReport }: { copy: CopyController; manifest: TonManifestStatus; apiBase: string; onReport?: SummaryReporter }) {
  const ton = useTonWalletState()
  const { view: balance, refresh } = useTonTestnetBalance(ton.balanceGate, apiBase)
  const host = new URL(apiBase).host
  const connected = ton.status === 'connected' || ton.status === 'disconnecting'
  const busy = ton.status === 'restoring' || ton.status === 'connecting' || ton.status === 'disconnecting'
  const network = ton.network
  // Stable callbacks prevent summary reports from retriggering a parent-store update on every render.
  // The wrappers never change identity: they read the latest provider callbacks through a ref, so a provider that
  // recreates connect/disconnect cannot change the summary (and so cannot re-trigger a report) by itself.
  const actions = useRef({ connect: ton.connect, disconnect: ton.disconnect })
  useEffect(() => { actions.current = { connect: ton.connect, disconnect: ton.disconnect } })
  const connectTon = useCallback(() => { void actions.current.connect() }, [])
  const disconnectTon = useCallback(() => { void actions.current.disconnect() }, [])

  const summary = useSummary({
    phase: ton.status === 'restoring' ? 'checking' : ton.status === 'connecting' ? 'connecting' : connected ? 'connected' : 'disconnected',
    walletName: ton.walletName ?? null,
    address: ton.friendlyAddress ?? ton.rawAddress ?? null,
    networkLabel: network ? TON_NETWORK_LABEL[network.kind] : null,
    networkSupported: network ? network.verifiedTestnet : null,
    chain: network?.chain ?? null,
    networkKind: network?.kind ?? null,
    connect: connectTon,
    disconnect: disconnectTon,
    disconnecting: ton.status === 'disconnecting',
  })
  useReportConnection(onReport, summary)

  let chip: { tone: TonChipTone; label: string }
  if (ton.status === 'restoring') chip = { tone: 'idle', label: 'Restoring session…' }
  else if (!connected) chip = { tone: 'idle', label: 'Not connected' }
  else if (network) chip = { tone: network.verifiedTestnet ? 'ok' : 'warn', label: TON_NETWORK_LABEL[network.kind] }
  else chip = { tone: 'idle', label: 'Identifying network…' }

  const announcement = ton.status === 'restoring' ? 'Restoring the TON wallet session.'
    : connected && network ? `TON wallet connected on ${TON_NETWORK_LABEL[network.kind]}.`
    : ton.status === 'connecting' ? 'Choose a wallet in the TON Connect window.' : ''

  return (
    <TonSectionFrame chip={chip} announcement={announcement}>
      {ton.error && (
        <div className="ton-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <div><p>{ton.error}</p><button type="button" className="wlt-link" onClick={ton.clearError}>Dismiss</button></div>
        </div>
      )}

      {ton.status === 'restoring' && (
        <p className="wlt-copy-text" role="status"><LoaderCircle className="wlt-spin ton-inline" size={14} aria-hidden="true" />Checking for a previously connected TON wallet…</p>
      )}

      {!connected && ton.status !== 'restoring' && (
        <div className="ton-body">
          <p className="wlt-copy-text">Connect a TON wallet using the <strong>Connect Wallet</strong> menu above to see your TON address and balance. This is separate from your Ethereum, Solana and TRON connections, which keep working as before.</p>
          <ManifestNotes manifest={manifest} />
        </div>
      )}

      {connected && ton.rawAddress && (
        <div className="ton-body">
          <div className="ton-row">
            <span className="ton-label">{ton.walletName ?? 'TON wallet'} account</span>
            <div className="wlt-address">
              <code title={ton.friendlyAddress ?? ton.rawAddress}>{shortenTonAddress(ton.friendlyAddress ?? ton.rawAddress, 8, 6)}</code>
              <CopyButton address={ton.friendlyAddress ?? ton.rawAddress} copy={copy} label="TON account" />
              {ton.onTestnet && <a className="wlt-link" href={tonTestnetAddressUrl(ton.friendlyAddress ?? ton.rawAddress)} target="_blank" rel="noopener noreferrer">Testnet explorer<ExternalLink size={12} aria-hidden="true" /></a>}
            </div>
          </div>

          {network && !network.verifiedTestnet && (
            <div className="ton-error is-warn" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              <div>
                <strong>{network.kind === 'mainnet' ? 'Your wallet is connected to TON Mainnet' : 'NEXORA could not identify this TON network'}</strong>
                <p>
                  {network.kind === 'unknown' ? `The wallet reported ${network.chain ? `network value “${network.chain.slice(0, 16)}”` : 'no network value'}, which NEXORA does not treat as TON testnet. ` : ''}
                  This milestone supports TON testnet only, so no balance is requested. TON Connect cannot switch networks for you: switch your wallet to <em>Testnet</em> in its own settings, then disconnect and connect again.
                </p>
              </div>
            </div>
          )}

          {ton.onTestnet && (
            <div className="ton-row">
              <span className="ton-label">Native balance · Testnet</span>
              <BalanceBlock view={balance} host={host} onRefresh={refresh} />
              <div className="wlt-actions">
                <button type="button" className="wlt-btn wlt-btn--sm" onClick={refresh} disabled={balance.status === 'loading'} aria-busy={balance.status === 'loading'}>
                  <RefreshCw size={13} className={balance.status === 'loading' ? 'wlt-spin' : ''} aria-hidden="true" />Refresh balance
                </button>
              </div>
            </div>
          )}

          {connected && <TonTransferForm balanceNano={balance.status === 'ready' ? balance.balance.nano : null} apiBase={apiBase} />}

          <div className="wlt-actions ton-foot">
            <button type="button" className="wlt-btn wlt-btn--quiet wlt-btn--sm" onClick={() => void ton.disconnect()} disabled={busy}><Power size={13} aria-hidden="true" />Disconnect TON</button>
          </div>
          <p className="wlt-note"><ShieldCheck size={13} aria-hidden="true" /><span>The network label comes from your wallet and is not independently verified; transfers are only offered when it says testnet. Balances come from one public testnet data service ({host}); without an API key it allows about one request per second. Disconnecting clears NEXORA’s TON session only; your wallet may still list this site as connected.</span></p>
        </div>
      )}
    </TonSectionFrame>
  )
}
