import { CircleAlert, RefreshCw } from 'lucide-react'
import type { NativeView } from '@/features/wallet/use-wallet-portfolio'
import { SourcePill } from '@/features/wallet/wallet-ui'

/**
 * One native-currency figure (ETH/POL/SOL…). Pure presentation of the project's existing read-only balance hooks:
 * an unknown balance is shown as "—", never as zero, and a failed read is an error, never an empty wallet.
 */
export function NativeFigure({ view, primary = true }: { view: NativeView; primary?: boolean }) {
  const unknown = view.display === null
  return (
    <div className={`wlt-figure ${primary ? 'is-primary' : ''}`}>
      <p className="wlt-eyebrow">Native balance · {view.networkName}<SourcePill status={view.status} /></p>
      <p className="wlt-figure__value" aria-live="polite" data-testid={view.ecosystem === 'solana' ? 'sol-balance' : 'native-balance'}>
        {view.loading && unknown
          ? <span className="wlt-skel wlt-skel--value" role="status" aria-label={`Loading ${view.symbol} balance`} />
          : <b className={unknown ? 'is-unknown' : ''}>{view.display ?? '—'}</b>}
        <span>{view.symbol}</span>
      </p>
      <div className="wlt-figure__notes">
        {view.error && (
          <p className="is-warn" role="alert">
            <CircleAlert size={13} aria-hidden="true" /><span>{view.error.message} This reflects the data provider, not necessarily the network.</span>
            {view.error.retryable && <button type="button" className="wlt-link" onClick={view.refresh}><RefreshCw size={12} aria-hidden="true" />Retry</button>}
          </p>
        )}
        {view.note && <p><CircleAlert size={13} aria-hidden="true" /><span>{view.note}</span></p>}
        {view.belowPrecision && <p><span>Below 0.000001 {view.symbol}; the display is truncated to 6 decimals.</span></p>}
        {view.status === 'live' && view.isZero && <p><span>The provider reports an exact zero balance on this network.</span></p>}
        {view.status === 'stale' && <p className="is-warn"><span>Showing the last successful read; the latest refresh failed.</span></p>}
        {view.provenance && <p className="is-dim"><span>{view.provenance}.{primary ? ' Native currency only; no fiat value is estimated.' : ''}</span></p>}
      </div>
    </div>
  )
}

export function WalletBalanceCard({ view, primary = true }: { view: NativeView; primary?: boolean }) {
  return <NativeFigure view={view} primary={primary} />
}
