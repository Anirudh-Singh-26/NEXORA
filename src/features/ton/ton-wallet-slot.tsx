import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { Buffer } from 'buffer'
import { CircleAlert } from 'lucide-react'
import type { CopyController } from '@/features/wallet/wallet-copy'
import { RowSkeletons } from '@/features/wallet/wallet-ui'
import type { SummaryReporter } from '@/features/wallet/wallet-connections'

// Some TON SDK dependencies expect Node's Buffer global. Install the browser-safe polyfill
// before the lazy TON module graph is evaluated, without changing other wallet sections.
const runtime = globalThis as typeof globalThis & { Buffer?: typeof Buffer }
runtime.Buffer ??= Buffer

const TonWalletSection = lazy(() => import('@/features/ton/ton-wallet-section').then((m) => ({ default: m.TonWalletSection })))

class TonBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('TON section failed to load', error, info.componentStack)
  }
  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <section id="wlt-ton" className="wlt-section" aria-label="TON wallet" tabIndex={-1}>
        <div className="wlt-state is-error" role="alert">
          <span className="wlt-state__icon" aria-hidden="true"><CircleAlert size={20} /></span>
          <div className="wlt-state__body">
            <strong>The TON section could not be loaded</strong>
            <p>Your other wallet connections are not affected. Reload the page to try again.</p>
            <button type="button" className="wlt-btn wlt-btn--sm" onClick={() => window.location.reload()}>Reload page</button>
          </div>
        </div>
      </section>
    )
  }
}

/**
 * Mount point on /wallet. TON Connect is code-split and isolated behind an error boundary, so a load or
 * initialisation failure here can never take down the EVM, Solana or TRON parts of the page.
 * The optional `onReport` prop lets the parent page count TON as a connected wallet.
 */
export function TonWalletSlot({ copy, onReport }: { copy: CopyController; onReport?: SummaryReporter }) {
  return (
    <TonBoundary>
      <Suspense fallback={<section id="wlt-ton" className="wlt-section" aria-label="TON wallet" tabIndex={-1}><RowSkeletons count={1} label="Loading TON wallet section" /></section>}>
        <TonWalletSection copy={copy} onReport={onReport} />
      </Suspense>
    </TonBoundary>
  )
}
