import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CircleAlert, CircleCheck, ExternalLink, Info, LoaderCircle, RefreshCw, Send, X } from 'lucide-react'
import { CopyButton, type CopyController } from '@/features/wallet/wallet-copy'
import { useSolanaTransfer } from '@/features/solana/use-solana-transfer'
import { formatSol } from '@/lib/solana-transfer/amount'
import { solanaDevnetAddressUrl, solanaDevnetTxUrl, SOLANA_FAUCET_HINT } from '@/lib/network/testnet'
import '@/styles/ton-wallet.css'

/**
 * Native SOL transfer on Solana DEVNET, following the TON transfer panel's layout and states. The connected wallet
 * (Phantom via Reown) shows the request and signs it; NEXORA never asks for or stores a seed phrase or private key.
 * The form is enabled only while the wallet positively reports Devnet (evaluateSolSendGate), the transaction is built
 * on a Devnet blockhash and relayed to Devnet through NEXORA's server, and a wallet approval is not the same as
 * confirmation: the panel keeps tracking the signature and says what it actually saw.
 */
export function SolanaSendPanel({ copy, onSettled, onClose }: { copy: CopyController; onSettled: () => void; onClose: () => void }) {
  const t = useSolanaTransfer(onSettled)
  const { gate, state, info, snapshot, maxLamports } = t
  const [recipientText, setRecipientText] = useState('')
  const [amountText, setAmountText] = useState('')
  const [touched, setTouched] = useState({ recipient: false, amount: false })
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const recipientInput = useRef<HTMLInputElement>(null)

  const { loadInfo } = t
  useEffect(() => { if (gate.allowed) void loadInfo() }, [gate.allowed, loadInfo])
  useEffect(() => { if (state.phase === 'reviewing') reviewHeading.current?.focus() }, [state.phase])

  const phase = state.phase
  const occupied = phase !== 'editing'
  const recipient = t.recipientCheck(recipientText)
  const amount = t.amountCheck(amountText)
  const recipientError = recipientText.trim() === '' && !touched.recipient ? null : !recipient.ok ? recipient.message : null
  let amountError: string | null = null
  if (amountText.trim() !== '' || touched.amount) {
    if (!amount.ok) amountError = amount.message
    else if (snapshot && amount.lamports + snapshot.fee > snapshot.balance) amountError = `Not enough SOL: this needs ${formatSol(amount.lamports + snapshot.fee)} SOL including the ${formatSol(snapshot.fee)} SOL fee, and you have ${formatSol(snapshot.balance)} SOL.`
  }
  const showRecipientError = touched.recipient && recipientError
  const showAmountError = touched.amount && amountError
  const busy = t.checking

  function submit(event: FormEvent) {
    event.preventDefault()
    setTouched({ recipient: true, amount: true })
    t.clearReviewError()
    if (!gate.allowed || !recipient.ok || !amount.ok || amountError) return
    void t.startReview(recipientText, amountText)
  }

  function useMax() {
    if (maxLamports === null) return
    setAmountText(formatSol(maxLamports))
    setTouched((value) => ({ ...value, amount: true }))
  }

  function backToEdit() {
    t.back()
    window.setTimeout(() => recipientInput.current?.focus(), 0)
  }

  // A transfer that reached the network clears the form; a blocked or rejected one keeps what was typed.
  const submittedSignature = state.submitted?.signature ?? null
  useEffect(() => {
    if (submittedSignature) { setRecipientText(''); setAmountText(''); setTouched({ recipient: false, amount: false }) }
  }, [submittedSignature])

  const review = state.review
  const submitted = state.submitted
  const notice = state.notice
  const detail = review ?? (submitted ? { recipient: submitted.recipient, lamports: submitted.lamports } : null)
  const fee = snapshot?.fee ?? submitted?.fee ?? 5000n
  const fieldsDisabled = !gate.allowed || occupied || busy

  return (
    <div className="ton-row ton-transfer" id="sol-send">
      <div className="wlt-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="ton-label" id="sol-transfer-title">Send SOL · Devnet</span>
        <button type="button" className="wlt-btn wlt-btn--quiet wlt-btn--sm" onClick={onClose} disabled={phase === 'sending'} aria-label="Close send panel"><X size={14} aria-hidden="true" />Close</button>
      </div>
      <p className="ton-transfer__note">Sends <strong>Devnet</strong> SOL, which has no monetary value, from your connected wallet. Your wallet shows and signs the request; NEXORA never sees your keys. {SOLANA_FAUCET_HINT}</p>

      {!gate.allowed && (
        <div className="ton-error is-warn" role="status">
          <CircleAlert size={16} aria-hidden="true" />
          <div><strong>Sending is disabled</strong><p>{gate.message}</p></div>
        </div>
      )}

      <div className="wlt-sr" role="status" aria-live="polite">
        {phase === 'sending' && 'Waiting for approval in your wallet.'}
        {phase === 'confirming' && 'Waiting for your transfer to be confirmed on Devnet.'}
        {phase !== 'sending' && phase !== 'confirming' && notice && notice.message}
      </div>

      {notice && phase !== 'sending' && phase !== 'confirming' && (
        <div className={`ton-notice is-${notice.tone}`}>
          {notice.tone === 'success' ? <CircleCheck size={16} aria-hidden="true" /> : notice.tone === 'info' ? <Info size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
          <div>
            <p>{notice.message}</p>
            {notice.signature && (
              <p className="ton-field__hint">Signature: <code>{notice.signature}</code> <CopyButton address={notice.signature} copy={copy} label="transaction signature" /></p>
            )}
            {notice.explorerUrl && (
              <a className="wlt-link" href={notice.explorerUrl} target="_blank" rel="noopener noreferrer">
                View transaction on Solana Devnet Explorer<ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
            {notice.tone === 'info' && submitted && (
              <button type="button" className="wlt-link" onClick={t.resumeConfirming}><RefreshCw size={12} aria-hidden="true" />Check again</button>
            )}
            <button type="button" className="wlt-link" onClick={t.dismiss}>Dismiss</button>
          </div>
        </div>
      )}

      {!occupied && (
        <form className="ton-form" onSubmit={submit} noValidate aria-labelledby="sol-transfer-title">
          <div className="ton-field">
            <label htmlFor="sol-recipient">Recipient address (Devnet)</label>
            <input
              id="sol-recipient" ref={recipientInput} className="ton-input ton-input--mono" type="text" inputMode="text" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
              placeholder="Solana address" value={recipientText} disabled={fieldsDisabled}
              aria-invalid={showRecipientError ? true : undefined} aria-describedby={showRecipientError ? 'sol-recipient-error' : 'sol-recipient-hint'}
              onChange={(e) => { setRecipientText(e.target.value); t.clearReviewError() }} onBlur={() => setTouched((v) => ({ ...v, recipient: true }))}
            />
            {showRecipientError ? <p className="ton-field__error" id="sol-recipient-error">{recipientError}</p> : <p className="ton-field__hint" id="sol-recipient-hint">A Solana address (base58). Compare it with your wallet's request before approving.</p>}
          </div>
          <div className="ton-field">
            <label htmlFor="sol-amount">Amount (SOL)</label>
            <input
              id="sol-amount" className="ton-input" type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
              placeholder="0.5" value={amountText} disabled={fieldsDisabled}
              aria-invalid={showAmountError ? true : undefined} aria-describedby={showAmountError ? 'sol-amount-error' : 'sol-amount-hint'}
              onChange={(e) => { setAmountText(e.target.value); t.clearReviewError() }} onBlur={() => setTouched((v) => ({ ...v, amount: true }))}
            />
            {showAmountError ? <p className="ton-field__error" id="sol-amount-error">{amountError}</p> : (
              <p className="ton-field__hint" id="sol-amount-hint">
                {info.status === 'loading' && 'Reading your Devnet balance…'}
                {info.status === 'error' && <>Could not read your Devnet balance: {info.message} <button type="button" className="wlt-link" onClick={() => void loadInfo()}>Try again</button></>}
                {snapshot && <>Available: <strong>{formatSol(snapshot.balance)} SOL</strong>. Network fee about {formatSol(snapshot.fee)} SOL (base fee for one signature; your wallet shows the final fee). Up to 9 decimals.{' '}
                  <button type="button" className="wlt-link" onClick={useMax} disabled={fieldsDisabled || maxLamports === null || maxLamports === 0n}>Use max</button></>}
              </p>
            )}
          </div>
          {t.reviewError && <p className="ton-field__error" role="alert">{t.reviewError}</p>}
          <div className="wlt-actions">
            <button type="submit" className="wlt-btn wlt-btn--primary" disabled={!gate.allowed || busy || info.status === 'loading'} aria-busy={busy}>
              {busy ? <LoaderCircle className="wlt-spin" size={15} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
              {busy ? 'Checking Devnet…' : 'Review transfer'}
            </button>
          </div>
        </form>
      )}

      {(phase === 'reviewing' || phase === 'sending') && review && (
        <div className="ton-review" role="group" aria-labelledby="sol-review-title" aria-busy={phase === 'sending'}>
          <h3 id="sol-review-title" ref={reviewHeading} tabIndex={-1}>{phase === 'sending' ? 'Waiting for your wallet' : 'Review before sending'}</h3>
          <dl className="ton-review__list">
            <div><dt>Network</dt><dd>Solana Devnet (no monetary value)</dd></div>
            <div><dt>Recipient</dt><dd><code>{review.recipient}</code></dd></div>
            <div><dt>Amount</dt><dd><strong>{formatSol(review.lamports)} SOL</strong><span className="ton-review__sub">{review.lamports.toLocaleString('en-US')} lamports</span></dd></div>
            <div><dt>Network fee</dt><dd>About {formatSol(fee)} SOL, charged in addition. Your wallet shows the final fee.</dd></div>
            <div><dt>Total from your account</dt><dd><strong>{formatSol(review.lamports + fee)} SOL</strong></dd></div>
          </dl>
          <p className="ton-field__hint"><a className="wlt-link" href={solanaDevnetAddressUrl(review.recipient) ?? undefined} target="_blank" rel="noopener noreferrer">Recipient on the Devnet explorer<ExternalLink size={12} aria-hidden="true" /></a> (an address page, not a transaction). Compare the recipient and amount with your wallet's request before approving.</p>
          <div className="wlt-actions">
            <button type="button" className="wlt-btn wlt-btn--primary" onClick={() => void t.confirm()} disabled={phase === 'sending' || !gate.allowed} aria-busy={phase === 'sending'}>
              {phase === 'sending' ? <LoaderCircle className="wlt-spin" size={15} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
              {phase === 'sending' ? 'Waiting for your wallet…' : 'Confirm in wallet'}
            </button>
            <button type="button" className="wlt-btn wlt-btn--quiet" onClick={backToEdit} disabled={phase === 'sending'}>Edit</button>
          </div>
          {phase === 'sending' && <p className="ton-field__hint">Approve or decline the request in your wallet. Do not click again: the request is already open.</p>}
        </div>
      )}

      {phase === 'confirming' && submitted && detail && (
        <div className="ton-review" role="group" aria-labelledby="sol-confirm-title" aria-busy>
          <h3 id="sol-confirm-title" tabIndex={-1}>Submitted: confirming on Devnet</h3>
          <dl className="ton-review__list">
            <div><dt>Recipient</dt><dd><code>{detail.recipient}</code></dd></div>
            <div><dt>Amount</dt><dd><strong>{formatSol(detail.lamports)} SOL</strong></dd></div>
            <div><dt>Signature</dt><dd><code>{submitted.signature}</code> <CopyButton address={submitted.signature} copy={copy} label="transaction signature" /></dd></div>
            <div><dt>Status</dt><dd>{state.chainState === 'processed' ? 'Processed, waiting for confirmation' : 'Sent to Devnet, not yet visible on chain'}</dd></div>
          </dl>
          <a className="wlt-link" href={solanaDevnetTxUrl(submitted.signature) ?? undefined} target="_blank" rel="noopener noreferrer">View on Solana Devnet Explorer<ExternalLink size={12} aria-hidden="true" /></a>
          <div className="wlt-actions">
            <button type="button" className="wlt-btn wlt-btn--primary" disabled aria-busy>
              <LoaderCircle className="wlt-spin" size={15} aria-hidden="true" />Checking for confirmation…
            </button>
          </div>
          <p className="ton-field__hint">NEXORA checks Devnet for up to a minute. Submission is not confirmation.</p>
        </div>
      )}

      <p className="ton-field__hint">Devnet only: Mainnet, Testnet and unknown networks are blocked, and the transaction is built on a Devnet blockhash.</p>
    </div>
  )
}
