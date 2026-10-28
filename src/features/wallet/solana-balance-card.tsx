import { useState } from 'react'
import { Send } from 'lucide-react'
import type { NativeView } from '@/features/wallet/use-wallet-portfolio'
import type { CopyController } from '@/features/wallet/wallet-copy'
import { NativeFigure } from '@/features/wallet/wallet-balance-card'
import { SolanaSendPanel } from '@/features/solana/solana-send-panel'

export interface SolanaSendOptions {
  copy: CopyController
  /** Called once a submitted transfer reaches a final state, so balance and activity can be refreshed. */
  onSettled: () => void
}

/**
 * Native SOL figure with a Devnet "Send" action. SPL tokens are not shown (said explicitly elsewhere, never simulated).
 * The send panel stays mounted after it is first opened (hidden when closed) so confirmation tracking of a submitted
 * transfer is never lost by closing the panel.
 */
export function SolanaBalanceCard({ view, primary = true, send }: { view: NativeView; primary?: boolean; send?: SolanaSendOptions }) {
  const [opened, setOpened] = useState(false)
  const [open, setOpen] = useState(false)
  return (
    <div>
      <NativeFigure view={view} primary={primary} />
      {send && (
        <>
          {!open && (
            <div className="wlt-actions">
              <button type="button" className="wlt-btn wlt-btn--sm wlt-btn--primary" onClick={() => { setOpened(true); setOpen(true) }} aria-expanded={open} aria-controls="sol-send">
                <Send size={14} aria-hidden="true" />Send
              </button>
            </div>
          )}
          {opened && (
            <div hidden={!open}>
              <SolanaSendPanel copy={send.copy} onSettled={send.onSettled} onClose={() => setOpen(false)} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
