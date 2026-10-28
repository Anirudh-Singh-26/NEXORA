import type { ReactNode } from 'react'

export type TonChipTone = 'ok' | 'warn' | 'idle'

/** Shared heading + status chip for every state of the TON section (loading, setup, error, connected). */
export function TonSectionFrame({ chip, announcement, children }: { chip: { tone: TonChipTone; label: string }; announcement?: string; children: ReactNode }) {
  return (
    <section id="wlt-ton" className="wlt-section ton-panel" aria-labelledby="ton-title" tabIndex={-1}>
      <div className="wlt-section-head">
        <div>
          <p className="wlt-eyebrow">TON · Testnet · read-only</p>
          <h2 id="ton-title">TON wallet</h2>
        </div>
        <span className={`wlt-chip is-${chip.tone}`}><i aria-hidden="true" />{chip.label}</span>
      </div>
      <p className="wlt-sr" role="status" aria-live="polite">{announcement ?? ''}</p>
      {children}
    </section>
  )
}
