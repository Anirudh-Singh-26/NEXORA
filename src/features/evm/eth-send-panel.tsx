import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CircleAlert, CircleCheck, ExternalLink, Info, LoaderCircle, RefreshCw, Send, X } from 'lucide-react'
import { CopyButton, type CopyController } from '@/features/wallet/wallet-copy'
import { useEthTransfer } from '@/features/evm/use-eth-transfer'
import { formatEth, maxFee } from '@/lib/eth-transfer/amount'
import { SEPOLIA_FAUCET_HINT, sepoliaAddressUrl, sepoliaTxUrl } from '@/lib/network/testnet'
import '@/styles/ton-wallet.css'

/**
 * Native ETH transfer on Ethereum SEPOLIA, following the Solana/TON transfer panels' layout and states. The connected
 * wallet (through Reown AppKit + wagmi) shows the request, signs and broadcasts it; NEXORA never asks for or stores a seed
 * phrase or private key. The form is enabled only while the wallet reports Sepolia (evaluateEthSendGate), and a wallet
 * approval is not confirmation: the panel keeps polling Sepolia for the receipt and says what it actually saw.
 */
export function EthSendPanel({ copy, onSettled, onClose }: { copy: CopyController; onSettled: () => void; onClose: () => void }) {
  const t = useEthTransfer(onSettled)
  const { gate, state, info, snapshot, maxWei } = t
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
    else if (snapshot && amount.wei + maxFee(snapshot) > snapshot.balance) amountError = `Not enough Sepolia ETH: this needs up to ${formatEth(amount.wei + maxFee(snapshot))} ETH including the network fee, and you have ${formatEth(snapshot.balance)} ETH.`
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
    if (maxWei === null) return
    setAmountText(formatEth(maxWei))
    setTouched((value) => ({ ...value, amount: true }))
  }

  function backToEdit() {
    t.back()
    window.setTimeout(() => recipientInput.current?.focus(), 0)
  }

  // A transfer that reached the network clears the form; a blocked or rejected one keeps what was typed.
  const submittedHash = state.submitted?.hash ?? null
  useEffect(() => {
    if (submittedHash) { setRecipientText(''); setAmountText(''); setTouched({ recipient: false, amount: false }) }
  }, [submittedHash])

  const review = state.review
  const submitted = state.submitted
  const notice = state.notice
  const detail = review ?? (submitted ? { recipient: submitted.recipient, wei: submitted.wei, maxFeeWei: submitted.maxFeeWei } : null)
  const fieldsDisabled = !gate.allowed || occupied || busy

  return (
    <div className="ton-row ton-transfer" id="eth-send">
      <div className="wlt-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="ton-label" id="eth-transfer-title">Send ETH · Sepolia</span>
        <button type="button" className="wlt-btn wlt-btn--quiet wlt-btn--sm" onClick={onClose} disabled={phase === 'sending'} aria-label="Close send panel"><X size={14} aria-hidden="true" />Close</button>
      </div>
      <p className="ton-transfer__note">Sends <strong>Sepolia</strong> ETH, which has no monetary value, from your connected wallet. Your wallet shows, signs and broadcasts the request; NEXORA never sees your keys. {SEPOLIA_FAUCET_HINT}</p>

      {!gate.allowed && (
        <div className="ton-error is-warn" role="status">
          <CircleAlert size={16} aria-hidden="true" />
          <div><strong>Sending is disabled</strong><p>{gate.message}</p></div>
        </div>
      )}

      <div className="wlt-sr" role="status" aria-live="polite">
        {phase === 'sending' && 'Waiting for approval in your wallet.'}
        {phase === 'confirming' && 'Waiting for your transfer to be confirmed on Sepolia.'}
        {phase !== 'sending' && phase !== 'confirming' && notice && notice.message}
      </div>

      {notice && phase !== 'sending' && phase !== 'confirming' && (
        <div className={`ton-notice is-${notice.tone}`}>
          {notice.tone === 'success' ? <CircleCheck size={16} aria-hidden="true" /> : notice.tone === 'info' ? <Info size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
          <div>
            <p>{notice.message}</p>
            {notice.hash && (
              <p className="ton-field__hint">Transaction hash: <code>{notice.hash}</code> <CopyButton address={notice.hash} copy={copy} label="transaction hash" /></p>
            )}
            {notice.explorerUrl && (
              <a className="wlt-link" href={notice.explorerUrl} target="_blank" rel="noopener noreferrer">
                View transaction on Sepolia Etherscan<ExternalLink size={12} aria-hidden="true" />
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
        <form className="ton-form" onSubmit={submit} noValidate aria-labelledby="eth-transfer-title">
          <div className="ton-field">
            <label htmlFor="eth-recipient">Recipient address (Sepolia)</label>
            <input
              id="eth-recipient" ref={recipientInput} className="ton-input ton-input--mono" type="text" inputMode="text" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
              placeholder="0x…" value={recipientText} disabled={fieldsDisabled}
              aria-invalid={showRecipientError ? true : undefined} aria-describedby={showRecipientError ? 'eth-recipient-error' : 'eth-recipient-hint'}
              onChange={(e) => { setRecipientText(e.target.value); t.clearReviewError() }} onBlur={() => setTouched((v) => ({ ...v, recipient: true }))}
            />
            {showRecipientError ? <p className="ton-field__error" id="eth-recipient-error">{recipientError}</p> : <p className="ton-field__hint" id="eth-recipient-hint">An Ethereum address (0x…). Compare it with your wallet's request before approving.</p>}
          </div>
          <div className="ton-field">
            <label htmlFor="eth-amount">Amount (ETH)</label>
            <input
              id="eth-amount" className="ton-input" type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
              placeholder="0.01" value={amountText} disabled={fieldsDisabled}
              aria-invalid={showAmountError ? true : undefined} aria-describedby={showAmountError ? 'eth-amount-error' : 'eth-amount-hint'}
              onChange={(e) => { setAmountText(e.target.value); t.clearReviewError() }} onBlur={() => setTouched((v) => ({ ...v, amount: true }))}
            />
            {showAmountError ? <p className="ton-field__error" id="eth-amount-error">{amountError}</p> : (
              <p className="ton-field__hint" id="eth-amount-hint">
                {info.status === 'loading' && 'Reading your Sepolia balance…'}
                {info.status === 'error' && <>Could not read your Sepolia balance: {info.message} <button type="button" className="wlt-link" onClick={() => void loadInfo()}>Try again</button></>}
                {snapshot && <>Available: <strong>{formatEth(snapshot.balance)} ETH</strong>. Network fee up to about {formatEth(maxFee(snapshot))} ETH (your wallet shows the final fee). Up to 18 decimals.{' '}
                  <button type="button" className="wlt-link" onClick={useMax} disabled={fieldsDisabled || maxWei === null || maxWei === 0n}>Use max</button></>}
              </p>
            )}
          </div>
          {t.reviewError && <p className="ton-field__error" role="alert">{t.reviewError}</p>}
          <div className="wlt-actions">
            <button type="submit" className="wlt-btn wlt-btn--primary" disabled={!gate.allowed || busy || info.status === 'loading'} aria-busy={busy}>
              {busy ? <LoaderCircle className="wlt-spin" size={15} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
              {busy ? 'Checking Sepolia…' : 'Review transfer'}
            </button>
          </div>
        </form>
      )}

      {(phase === 'reviewing' || phase === 'sending') && review && (
        <div className="ton-review" role="group" aria-labelledby="eth-review-title" aria-busy={phase === 'sending'}>
          <h3 id="eth-review-title" ref={reviewHeading} tabIndex={-1}>{phase === 'sending' ? 'Waiting for your wallet' : 'Review before sending'}</h3>
          <dl className="ton-review__list">
            <div><dt>Network</dt><dd>Ethereum Sepolia (no monetary value)</dd></div>
            <div><dt>Recipient</dt><dd><code>{review.recipient}</code></dd></div>
            <div><dt>Amount</dt><dd><strong>{formatEth(review.wei)} ETH</strong><span className="ton-review__sub">{review.wei.toLocaleString('en-US')} wei</span></dd></div>
            <div><dt>Network fee</dt><dd>Up to about {formatEth(review.maxFeeWei)} ETH, charged in addition. Your wallet shows the final fee.</dd></div>
            <div><dt>Most from your account</dt><dd><strong>{formatEth(review.wei + review.maxFeeWei)} ETH</strong></dd></div>
          </dl>
          <p className="ton-field__hint"><a className="wlt-link" href={sepoliaAddressUrl(review.recipient) ?? undefined} target="_blank" rel="noopener noreferrer">Recipient on Sepolia Etherscan<ExternalLink size={12} aria-hidden="true" /></a> (an address page, not a transaction). Compare the recipient and amount with your wallet's request before approving.</p>
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
        <div className="ton-review" role="group" aria-labelledby="eth-confirm-title" aria-busy>
          <h3 id="eth-confirm-title" tabIndex={-1}>Submitted: confirming on Sepolia</h3>
          <dl className="ton-review__list">
            <div><dt>Recipient</dt><dd><code>{detail.recipient}</code></dd></div>
            <div><dt>Amount</dt><dd><strong>{formatEth(detail.wei)} ETH</strong></dd></div>
            <div><dt>Transaction hash</dt><dd><code>{submitted.hash}</code> <CopyButton address={submitted.hash} copy={copy} label="transaction hash" /></dd></div>
            <div><dt>Status</dt><dd>Broadcast by your wallet, waiting for a Sepolia block</dd></div>
          </dl>
          <a className="wlt-link" href={sepoliaTxUrl(submitted.hash) ?? undefined} target="_blank" rel="noopener noreferrer">View on Sepolia Etherscan<ExternalLink size={12} aria-hidden="true" /></a>
          <div className="wlt-actions">
            <button type="button" className="wlt-btn wlt-btn--primary" disabled aria-busy>
              <LoaderCircle className="wlt-spin" size={15} aria-hidden="true" />Checking for confirmation…
            </button>
          </div>
          <p className="ton-field__hint">NEXORA checks Sepolia for up to two minutes. Submission is not confirmation.</p>
        </div>
      )}

      <p className="ton-field__hint">Sepolia only: Mainnet and other networks are blocked, and the request is pinned to Sepolia.</p>
    </div>
  )
}
