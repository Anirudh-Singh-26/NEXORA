import { useId, useMemo, useState } from 'react'
import { CircleAlert, ExternalLink, LoaderCircle, RefreshCw, Send } from 'lucide-react'
import { CopyButton, type CopyController } from '@/features/wallet/wallet-copy'
import { useTronWallet } from '@/features/tron/tron-provider'
import { useSendTrx, type SubmittedTransfer } from '@/features/tron/use-send-trx'
import type { ShastaBalanceView } from '@/features/tron/use-shasta-balance'
import { formatSunAsTrx, shortenTronAddress } from '@/lib/tron/format'
import { shastaTxUrl } from '@/lib/tron/network'
import { checkSufficientBalance, evaluateSendGate, parseTrxAmount, validateRecipient, type TxState } from '@/lib/tron/transfer'

const STATE_COPY: Record<TxState, { tone: 'ok' | 'warn' | 'idle'; label: string; detail: string }> = {
  pending: { tone: 'idle', label: 'Pending', detail: 'Shasta accepted the broadcast. Waiting for it to appear in a block.' },
  included: { tone: 'idle', label: 'Included in a block', detail: 'It is in a block but not yet final. Waiting for Shasta’s solidity (irreversible) data.' },
  confirmed: { tone: 'ok', label: 'Confirmed', detail: 'Confirmed by Shasta’s irreversible (solidity) data.' },
  failed: { tone: 'warn', label: 'Failed on chain', detail: 'The transaction was included but did not succeed.' },
  'not-found': { tone: 'warn', label: 'Not found', detail: 'Shasta has no record of it after it expired.' },
}

function Tracking({ submitted, copy, onCheck, onReset }: { submitted: SubmittedTransfer; copy: CopyController; onCheck: () => void; onReset: () => void }) {
  const { status } = submitted
  const view = status ? STATE_COPY[status.state] : { tone: 'idle' as const, label: 'Broadcast', detail: 'Broadcast accepted. Checking Shasta for the transaction…' }
  const final = status !== null && (status.state === 'confirmed' || status.state === 'failed' || status.state === 'not-found')
  return (
    <div className="tron-tx" aria-live="polite">
      <div className="tron-tx__head">
        <span className={`wlt-chip is-${view.tone}`}><i aria-hidden="true" />{view.label}{status?.blockNumber ? ` · block ${status.blockNumber}` : ''}</span>
        {submitted.checking && <LoaderCircle className="wlt-spin tron-inline" size={14} aria-label="Checking status" />}
      </div>
      <p className="wlt-copy-text">{view.detail}</p>
      <p className="tron-figure__note">Sent {formatSunAsTrx(submitted.intent.sun, 2)} TRX to {shortenTronAddress(submitted.intent.recipient, 8, 6)} on Shasta testnet.</p>
      <div className="wlt-address">
        <span className="tron-label">Transaction ID</span>
        <code title={submitted.txId}>{shortenTronAddress(submitted.txId, 10, 8)}</code>
        <CopyButton address={submitted.txId} copy={copy} label="Shasta transaction ID" />
        <a className="wlt-link" href={shastaTxUrl(submitted.txId)} target="_blank" rel="noopener noreferrer">View on Shasta explorer<ExternalLink size={12} aria-hidden="true" /></a>
      </div>
      {status?.feeSun != null && <p className="tron-figure__note">Network fee reported by Shasta: {formatSunAsTrx(status.feeSun, 0)} TRX.</p>}
      {status?.message && <p className="tron-figure__note">{status.message}</p>}
      {submitted.statusError && <p className="tron-figure__note" role="alert">Could not read the status just now: {submitted.statusError}</p>}
      {submitted.pollingStopped && <p className="tron-figure__note">Automatic checking stopped after about five minutes. Use “Check status” or the explorer.</p>}
      {status && <p className="tron-figure__note">Last checked {new Date(status.checkedAt).toLocaleTimeString()}.</p>}
      <div className="wlt-actions">
        <button type="button" className="wlt-btn wlt-btn--sm" onClick={onCheck} disabled={submitted.checking}><RefreshCw size={13} aria-hidden="true" />Check status</button>
        {final && <button type="button" className="wlt-btn wlt-btn--sm wlt-btn--primary" onClick={onReset}>Send another</button>}
      </div>
    </div>
  )
}

/**
 * Send TRX on Shasta. The form itself exists only while the provider reports verified Shasta; a transfer already
 * broadcast keeps being tracked (against Shasta, independent of the wallet's current network) until the user starts a new one.
 */
export function TronSendSection({ sender, balance, onRefreshBalance, copy }: { sender: string; balance: ShastaBalanceView; onRefreshBalance: () => void; copy: CopyController }) {
  const tron = useTronWallet()
  const send = useSendTrx(onRefreshBalance)
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [touched, setTouched] = useState({ recipient: false, amount: false })
  const ids = { recipient: useId(), amount: useId(), help: useId() }

  const recipientCheck = useMemo(() => validateRecipient(recipient, sender), [recipient, sender])
  const amountCheck = useMemo(() => parseTrxAmount(amount), [amount])
  const balanceSun = balance.status === 'ready' ? balance.balance.sun : null
  const funds = amountCheck.ok && balanceSun !== null ? checkSufficientBalance(balanceSun, amountCheck.sun) : null
  const gate = evaluateSendGate({ connected: tron.status === 'connected', address: tron.address, expectedSender: sender, identity: tron.network.status === 'ready' ? tron.network.identity : null })
  const busy = send.phase !== 'idle'

  if (send.submitted) return <div className="tron-row"><span className="tron-label">Send TRX · Shasta testnet</span><Tracking submitted={send.submitted} copy={copy} onCheck={send.checkNow} onReset={() => { send.reset(); setRecipient(''); setAmount(''); setTouched({ recipient: false, amount: false }) }} /></div>
  if (!gate.ok) return <p className="tron-figure__note">Sending is disabled: {gate.message}</p>

  const amountProblem = touched.amount && !amountCheck.ok ? amountCheck.message : touched.amount && funds && !funds.ok ? funds.message : null
  const recipientProblem = touched.recipient && !recipientCheck.ok ? recipientCheck.message : null
  const canSubmit = recipientCheck.ok && amountCheck.ok && funds !== null && funds.ok && gate.ok && !busy
  const phaseLabel = send.phase === 'building' ? 'Preparing transaction…' : send.phase === 'awaiting-wallet' ? 'Approve in TronLink…' : send.phase === 'broadcasting' ? 'Broadcasting…' : 'Send TRX'

  return (
    <form
      className="tron-row tron-send"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setTouched({ recipient: true, amount: true })
        if (!canSubmit || !amountCheck.ok) return
        void send.send({ sender, recipient: recipient.trim(), sun: amountCheck.sun })
      }}
    >
      <span className="tron-label">Send TRX · Shasta testnet</span>
      <div className="tron-field">
        <label htmlFor={ids.recipient}>Recipient address</label>
        <input id={ids.recipient} type="text" inputMode="text" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="T…" value={recipient} disabled={busy}
          aria-invalid={recipientProblem !== null} aria-describedby={recipientProblem ? `${ids.recipient}-err` : undefined}
          onChange={(e) => setRecipient(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, recipient: true }))} />
        {recipientProblem && <p id={`${ids.recipient}-err`} className="tron-field__error" role="alert">{recipientProblem}</p>}
      </div>
      <div className="tron-field">
        <label htmlFor={ids.amount}>Amount (TRX)</label>
        <input id={ids.amount} type="text" inputMode="decimal" autoComplete="off" placeholder="0.0" value={amount} disabled={busy}
          aria-invalid={amountProblem !== null} aria-describedby={`${ids.help}${amountProblem ? ` ${ids.amount}-err` : ''}`}
          onChange={(e) => setAmount(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, amount: true }))} />
        {amountProblem && <p id={`${ids.amount}-err`} className="tron-field__error" role="alert">{amountProblem}</p>}
        <p id={ids.help} className="tron-figure__note">
          {balanceSun !== null ? `Available: ${formatSunAsTrx(balanceSun, 2)} TRX. ` : 'Your Shasta balance has not loaded yet. '}
          Network fees (bandwidth or burned TRX) are charged by Shasta on top and are not estimated here, so keep some TRX spare. Sending to an address that has never been activated can cost extra.
          {funds && funds.ok && funds.leavesNothingForFees ? ' This amount leaves nothing for fees and will probably fail.' : ''}
        </p>
      </div>
      {amountCheck.ok && recipientCheck.ok && (
        <p className="tron-figure__note">You will send {formatSunAsTrx(amountCheck.sun, 0)} TRX ({amountCheck.sun.toString()} SUN) to {shortenTronAddress(recipient.trim(), 8, 6)} on the Shasta testnet. TronLink will ask you to approve it.</p>
      )}
      {send.error && (
        <div className="tron-error" role="alert"><CircleAlert size={16} aria-hidden="true" /><div><p>{send.error}</p><button type="button" className="wlt-link" onClick={send.clearError}>Dismiss</button></div></div>
      )}
      <div className="wlt-actions">
        <button type="submit" className="wlt-btn wlt-btn--primary" disabled={!canSubmit} aria-busy={busy}>
          {busy ? <LoaderCircle className="wlt-spin" size={15} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}{phaseLabel}
        </button>
      </div>
    </form>
  )
}
