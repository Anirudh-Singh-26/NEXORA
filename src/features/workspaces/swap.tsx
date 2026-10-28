import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowDownUp, Check, ShieldAlert } from 'lucide-react'
import { Sparkline } from '@/components/shared/sparkline'
import { TokenGlyph } from '@/components/shared/token-glyph'
import { catalog } from '@/data/catalog'
import { formatUsd } from '@/lib/format'
import { dur, ease } from '@/lib/motion'
import { getToken } from '@/data/selectors'

export function SwapWorkspace() {
  const [amount, setAmount] = useState('1')
  const [fromToken, setFromToken] = useState('eth')
  const [toToken, setToToken] = useState('sol')
  const [state, setState] = useState<'idle' | 'preview' | 'complete'>('idle')

  const from = getToken(fromToken)
  const to = getToken(toToken)
  const numeric = Number(amount)
  const validAmount = amount.trim() !== '' && Number.isFinite(numeric) && numeric > 0
  const sameToken = fromToken === toToken
  const canReview = validAmount && !sameToken
  const rate = (from?.price ?? 1) / (to?.price ?? 1)
  const receive = validAmount ? numeric * rate * 0.997 : 0
  const payUsd = validAmount ? numeric * (from?.price ?? 0) : 0
  const reset = () => setState('idle')
  const options = catalog.tokens.slice(0, 8)

  const tokenSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <select value={value} onChange={(e) => { onChange(e.target.value); reset() }} className="h-10 rounded-lg border border-line bg-inset px-3 text-[13px] font-medium" aria-label={label}>
      {options.map((token) => <option key={token.id} value={token.id}>{token.ticker}</option>)}
    </select>
  )

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,520px)_1fr]">
      <section className="nx-panel rounded-2xl p-5 md:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold tracking-tight">Exchange preview</h2>
          <span className="nx-eyebrow rounded-full border border-copper/40 px-2.5 py-1 text-[9px] text-copper">Simulated</span>
        </div>

        <div className="mt-5 space-y-1.5">
          <label className="block rounded-xl border border-line bg-canvas/70 p-4">
            <span className="nx-eyebrow text-[9.5px]">You pay</span>
            <div className="mt-2.5 flex items-center gap-3">
              <input type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); reset() }} className="min-w-0 flex-1 bg-transparent font-mono text-[26px] tabular-nums outline-none" aria-label="Amount to swap" />
              {tokenSelect(fromToken, setFromToken, 'Source token')}
            </div>
            <p className="mt-2 font-mono text-[11.5px] tabular-nums text-mute">{validAmount ? `≈ ${formatUsd(payUsd)}` : 'Illustrative balance only'}</p>
          </label>

          <div className="relative z-10 -my-3 flex justify-center">
            <motion.button whileTap={{ rotate: 180 }} transition={{ duration: dur.base, ease }} type="button" onClick={() => { setFromToken(toToken); setToToken(fromToken); reset() }} className="flex size-9 items-center justify-center rounded-full border border-line bg-inset text-mute transition-colors hover:border-copper/40 hover:text-ink" aria-label="Switch tokens">
              <ArrowDownUp size={16} />
            </motion.button>
          </div>

          <div className="rounded-xl border border-line bg-canvas/70 p-4">
            <span className="nx-eyebrow text-[9.5px]">You receive (estimated)</span>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate font-mono text-[26px] tabular-nums" aria-live="polite">{validAmount ? receive.toFixed(6) : '—'}</p>
              {tokenSelect(toToken, setToToken, 'Destination token')}
            </div>
          </div>
        </div>

        <dl className="my-5 space-y-2 text-[12.5px]">
          <div className="flex justify-between text-mute"><dt>Demo exchange rate</dt><dd className="font-mono tabular-nums text-ink">1 {from?.ticker} ≈ {rate.toFixed(6)} {to?.ticker}</dd></div>
          <div className="flex justify-between text-mute"><dt>Illustrative fee</dt><dd className="font-mono tabular-nums text-ink">0.3%</dd></div>
          <div className="flex justify-between text-mute"><dt>Route</dt><dd className="text-ink">Simulated · no network</dd></div>
        </dl>

        {state === 'preview' ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-copper/30 bg-copper/[0.05] p-3 text-[12.5px] leading-5 text-mute">Preview only. No wallet is connected and no transaction will be sent.</p>
            <button type="button" onClick={() => setState('complete')} className="w-full rounded-lg bg-ink py-3 text-sm font-medium text-canvas transition-opacity hover:opacity-90">Simulate confirmation</button>
            <button type="button" onClick={reset} className="w-full py-2 text-sm text-mute hover:text-ink">Cancel</button>
          </div>
        ) : state === 'complete' ? (
          <div className="rounded-lg border border-line p-4 text-center" role="status">
            <Check className="mx-auto mb-2 text-copper" />
            <p className="font-medium">Demo simulation complete</p>
            <p className="mt-1 text-xs text-mute">No tokens moved. This was not a blockchain transaction.</p>
            <button type="button" onClick={reset} className="mt-3 text-sm underline">Start another preview</button>
          </div>
        ) : (
          <button type="button" onClick={() => setState(canReview ? 'preview' : 'idle')} disabled={!canReview} className="w-full rounded-lg bg-ink py-3 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">
            {sameToken ? 'Choose different tokens' : 'Review swap'}
          </button>
        )}
        {!validAmount ? <p className="mt-3 text-xs text-loss" role="alert">Enter an amount greater than zero.</p> : null}
        {sameToken ? <p className="mt-3 text-xs text-loss" role="alert">Choose two different tokens to preview a swap.</p> : null}
      </section>

      <aside className="space-y-4">
        <div className="nx-surface rounded-xl p-4">
          <p className="nx-eyebrow text-[9.5px]">Pair snapshot</p>
          <div className="mt-3 space-y-3">
            {[from, to].map((t, i) => t ? (
              <Link key={`${t.id}-${i}`} to={`/tokens/${t.id}`} className="group flex items-center gap-3">
                <TokenGlyph token={t} />
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium group-hover:text-copper">{t.name}</span><span className="block font-mono text-[11px] tabular-nums text-mute">{formatUsd(t.price)}</span></span>
                <Sparkline data={t.sparkline} positive={t.change24h >= 0} className="w-20" />
              </Link>
            ) : null)}
          </div>
        </div>
        <p className="flex items-start gap-2 rounded-lg border border-dashed border-line/80 px-3.5 py-2.5 text-[11.5px] leading-5 text-mute">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-copper" />
          Rates are derived from fictional quotes. No wallet connection or blockchain transaction is performed.
        </p>
      </aside>
    </div>
  )
}

/* ── Rewards: progress ledger ──────────────────────────────────────────── */
