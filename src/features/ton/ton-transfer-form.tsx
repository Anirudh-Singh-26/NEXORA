import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from 'react'
import { CircleAlert, CircleCheck, ExternalLink, Info, LoaderCircle, RefreshCw, Send } from 'lucide-react'
import { useTonConnectUI } from '@tonconnect/ui-react'
import { useTonWalletState } from '@/features/ton/ton-provider'
import { tonTestnetAddressUrl } from '@/lib/ton/address'
import { formatNanoTon, formatNanoTonUnits } from '@/lib/ton/format'
import {
  buildTonTransferRequest,
  checkTonAffordability,
  evaluateTonTransferGate,
  parseTonAmount,
  submitTonTransfer,
  TON_TRANSFER_MAX_NANO,
  validateTonRecipient,
} from '@/lib/ton/transfer'
import { initialTonTransferFlow, tonTransferFlowReducer } from '@/lib/ton/transfer-flow'
import {
  BASELINE_TIMEOUT_MS,
  fetchBaselineLt,
  TonConfirmationError,
  type TonConfirmationResult,
} from '@/lib/ton/confirmation'
import { useTonTransferConfirmation } from '@/features/ton/use-ton-transfer-confirmation'
import { extractTrackedMessage } from '@/lib/ton/confirmation-codec'

/**
 * Native TON TESTNET transfer. Signing stays inside TON Connect (`sendTransaction`); NEXORA never sees keys.
 * The form is enabled only while the wallet has positively reported chain "-3" (see evaluateTonTransferGate) and every
 * request is sent with `network: '-3'`. A resolved request means the wallet accepted it, not that the chain confirmed it.
 *
 * Phase 3: the baseline LT is fetched before the wallet prompt. If successful, the hook polls for
 * the transaction after wallet acceptance. If baseline fails, the user chooses to send without
 * tracking or cancel. Wallet acceptance is never treated as on-chain confirmation.
 */
export function TonTransferForm({ balanceNano, apiBase }: { balanceNano: bigint | null; apiBase: string }) {
  const ton = useTonWalletState()
  const [tonConnectUI] = useTonConnectUI()
  const [recipientText, setRecipientText] = useState('')
  const [amountText, setAmountText] = useState('')
  const [touched, setTouched] = useState({ recipient: false, amount: false })
  const [flow, dispatch] = useReducer(tonTransferFlowReducer, initialTonTransferFlow)
  const sending = useRef(false)
  const mounted = useRef(true)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const recipientInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const gate = evaluateTonTransferGate({
    restored: ton.status !== 'restoring',
    chain: ton.network?.chain ?? null,
    address: ton.status === 'connected' ? ton.rawAddress : null,
  })
  const gateOpen = gate.allowed
  const ownAddress = gate.allowed ? gate.address : null

  const recipient = useMemo(() => validateTonRecipient(recipientText, ownAddress), [recipientText, ownAddress])
  const amount = useMemo(() => parseTonAmount(amountText), [amountText])
  const affordability = amount.ok ? checkTonAffordability(amount.nano, balanceNano) : null

  const recipientError = !recipient.ok ? recipient.message : null
  const amountError = !amount.ok ? amount.message : affordability

  const phase = flow.phase
  const inReview = phase === 'reviewing'
  const inBaselineFetching = phase === 'baseline-fetching'
  const inBaselineFailed = phase === 'baseline-failed'
  const inPending = phase === 'pending'
  const inConfirming = phase === 'confirming'

  // True for any phase where the form is not shown
  const occupied = inReview || inBaselineFetching || inBaselineFailed || inPending || inConfirming

  // Abort when gate closes during phases that have not yet sent the wallet request
  useEffect(() => {
    if (!gateOpen && (inReview || inBaselineFetching || inBaselineFailed)) {
      dispatch({ type: 'abort', message: 'The wallet is no longer connected on TON testnet, so the review was cancelled. Nothing was sent.' })
    }
  }, [gateOpen, inReview, inBaselineFetching, inBaselineFailed])

  useEffect(() => {
    if (inReview) reviewHeading.current?.focus()
  }, [inReview])

  // Polling hook — active only during 'confirming'
  const retryCtx = flow.retryContext
  const onConfirmationResult = useCallback((result: TonConfirmationResult) => {
    if (mounted.current) dispatch({ type: 'confirmation', result })
  }, [])
  useTonTransferConfirmation({
    enabled: inConfirming,
    senderAddress: retryCtx?.senderAddress ?? null,
    baselineLt:    retryCtx?.baselineLt    ?? null,
    recipient:     retryCtx?.recipient     ?? null,
    amountNano:    retryCtx?.amountNano    ?? null,
    tracked:       retryCtx?.tracked       ?? null,
    apiBase,
    onResult: onConfirmationResult,
  })

  function startReview(event: FormEvent) {
    event.preventDefault()
    setTouched({ recipient: true, amount: true })
    if (!gate.allowed || !recipient.ok || !amount.ok || affordability !== null) return
    dispatch({ type: 'review', review: { recipient: recipient.address, amountNano: amount.nano } })
  }

  async function confirmSend() {
    const review = flow.review
    if (sending.current || !inReview || !review || !gate.allowed) return
    sending.current = true
    dispatch({ type: 'fetch-baseline' })

    // Fetch baseline BEFORE opening the wallet prompt
    let baselineLt: bigint
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), BASELINE_TIMEOUT_MS)
      try {
        baselineLt = await fetchBaselineLt(gate.address, { base: apiBase, signal: ctrl.signal })
      } finally {
        clearTimeout(timer)
      }
      if (!mounted.current) { sending.current = false; return }
      dispatch({ type: 'baseline-ok', baselineLt })
    } catch (err) {
      sending.current = false
      if (!mounted.current) return
      const message = err instanceof TonConfirmationError
        ? `Could not read the account baseline before sending: ${err.message} You may still send, but automatic confirmation tracking will be unavailable.`
        : 'Could not read the account baseline before sending. You may still send, but automatic confirmation tracking will be unavailable.'
      dispatch({ type: 'baseline-fail', message })
      return
    }

    // Built at click time so the 5-minute expiry starts when the wallet is actually asked
    const request = buildTonTransferRequest(review.recipient, review.amountNano, Date.now())
    let capturedBoc: string | null = null
    const outcome = await submitTonTransfer(
      async (req) => {
        const result = await tonConnectUI.sendTransaction(req)
        capturedBoc = result.boc
        return result
      },
      request,
    )
    sending.current = false
    if (!mounted.current) return

    if (outcome.status !== 'submitted') {
      dispatch({ type: 'outcome', outcome })
      return
    }

    // Wallet accepted — clear form fields
    setRecipientText('')
    setAmountText('')
    setTouched({ recipient: false, amount: false })

    const senderAddress = gate.allowed ? gate.address : null
    if (senderAddress !== null) {
      const tracked = capturedBoc !== null ? extractTrackedMessage(capturedBoc) : null
      dispatch({ type: 'start-confirming', senderAddress, tracked })
    } else {
      // Gate closed between baseline-ok and now — fall back to submitted notice
      dispatch({ type: 'outcome', outcome })
    }
  }

  async function handleSendWithoutTracking() {
    if (!flow.review || !gate.allowed || sending.current) return
    const review = flow.review
    dispatch({ type: 'send-without-tracking' })
    sending.current = true
    const request = buildTonTransferRequest(review.recipient, review.amountNano, Date.now())
    const outcome = await submitTonTransfer((req) => tonConnectUI.sendTransaction(req), request)
    sending.current = false
    if (!mounted.current) return
    if (outcome.status === 'submitted') {
      setRecipientText('')
      setAmountText('')
      setTouched({ recipient: false, amount: false })
    }
    dispatch({ type: 'outcome', outcome })
  }

  function backToEdit() {
    dispatch({ type: 'back' })
    window.setTimeout(() => recipientInput.current?.focus(), 0)
  }

  const fieldsDisabled = !gate.allowed || occupied
  const showRecipientError = touched.recipient && recipientError
  const showAmountError = touched.amount && amountError
  const notice = flow.notice
  const maxText = formatNanoTon(TON_TRANSFER_MAX_NANO, 0)

  // Review data: from flow.review during review/baseline phases, from retryContext during confirming
  const reviewData = flow.review ?? (retryCtx ? { recipient: retryCtx.recipient, amountNano: retryCtx.amountNano } : null)

  const canRetry = flow.phase === 'editing' && flow.retryContext !== null

  return (
    <div className="ton-row ton-transfer">
      <span className="ton-label" id="ton-transfer-title">Send TON · Testnet</span>
      <p className="ton-transfer__note">Sends <strong>testnet</strong> TON, which has no market value, from your connected wallet. Your wallet shows and signs the request; NEXORA never sees your keys.</p>

      {!gate.allowed && (
        <div className="ton-error is-warn" role="status">
          <CircleAlert size={16} aria-hidden="true" />
          <div><strong>Sending is disabled</strong><p>{gate.message}</p></div>
        </div>
      )}

      <div className="wlt-sr" role="status" aria-live="polite">
        {inPending && 'Waiting for approval in your wallet.'}
        {inBaselineFetching && 'Fetching account baseline before opening your wallet.'}
        {inConfirming && 'Waiting for your transfer to appear on-chain.'}
        {!inPending && !inBaselineFetching && !inConfirming && notice && notice.message}
      </div>

      {notice && !inPending && !inConfirming && (
        <div className={`ton-notice is-${notice.tone}`}>
          {notice.tone === 'success' ? <CircleCheck size={16} aria-hidden="true" /> : notice.tone === 'info' ? <Info size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
          <div>
            <p>{notice.message}</p>
            {notice.explorerUrl && (
              <a className="wlt-link" href={notice.explorerUrl} target="_blank" rel="noopener noreferrer">
                View transaction on testnet explorer<ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
            {!notice.explorerUrl && notice.tone === 'success' && ton.friendlyAddress && (
              <a className="wlt-link" href={tonTestnetAddressUrl(ton.friendlyAddress)} target="_blank" rel="noopener noreferrer">
                Your address on the testnet explorer<ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
            {canRetry && (
              <button type="button" className="wlt-link" onClick={() => dispatch({ type: 'retry-confirmation' })}>
                <RefreshCw size={12} aria-hidden="true" />Retry lookup
              </button>
            )}
            <button type="button" className="wlt-link" onClick={() => dispatch({ type: 'dismiss' })}>Dismiss</button>
          </div>
        </div>
      )}

      {!occupied && (
        <form className="ton-form" onSubmit={startReview} noValidate aria-labelledby="ton-transfer-title">
          <div className="ton-field">
            <label htmlFor="ton-recipient">Recipient address (testnet)</label>
            <input
              id="ton-recipient"
              ref={recipientInput}
              className="ton-input ton-input--mono"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="0Q. or kQ."
              value={recipientText}
              disabled={fieldsDisabled}
              aria-invalid={showRecipientError ? true : undefined}
              aria-describedby={showRecipientError ? 'ton-recipient-error' : 'ton-recipient-hint'}
              onChange={(e) => setRecipientText(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, recipient: true }))}
            />
            {showRecipientError ? <p className="ton-field__error" id="ton-recipient-error">{recipientError}</p> : <p className="ton-field__hint" id="ton-recipient-hint">A TON testnet address starting with 0Q or kQ.</p>}
          </div>
          <div className="ton-field">
            <label htmlFor="ton-amount">Amount (TON)</label>
            <input
              id="ton-amount"
              className="ton-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              placeholder="0.5"
              value={amountText}
              disabled={fieldsDisabled}
              aria-invalid={showAmountError ? true : undefined}
              aria-describedby={showAmountError ? 'ton-amount-error' : 'ton-amount-hint'}
              onChange={(e) => setAmountText(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
            />
            {showAmountError ? <p className="ton-field__error" id="ton-amount-error">{amountError}</p> : <p className="ton-field__hint" id="ton-amount-hint">Up to 9 decimals, at most {maxText} TON. Network fees are extra and set by your wallet.</p>}
          </div>
          <div className="wlt-actions">
            <button type="submit" className="wlt-btn wlt-btn--primary" disabled={!gate.allowed}>
              <Send size={15} aria-hidden="true" />Review transfer
            </button>
          </div>
        </form>
      )}

      {(inReview || inBaselineFetching) && reviewData && (
        <div className="ton-review" role="group" aria-labelledby="ton-review-title" aria-busy={inBaselineFetching}>
          <h3 id="ton-review-title" ref={reviewHeading} tabIndex={-1}>Review before sending</h3>
          <dl className="ton-review__list">
            <div><dt>Network</dt><dd>TON Testnet (no market value)</dd></div>
            <div><dt>Recipient</dt><dd><code>{reviewData.recipient}</code></dd></div>
            <div><dt>Amount</dt><dd><strong>{formatNanoTon(reviewData.amountNano)} TON</strong><span className="ton-review__sub">{formatNanoTonUnits(reviewData.amountNano)} nanoTON</span></dd></div>
            <div><dt>Network fee</dt><dd>Set by your wallet and charged in addition</dd></div>
          </dl>
          <p className="ton-field__hint"><a className="wlt-link" href={tonTestnetAddressUrl(reviewData.recipient)} target="_blank" rel="noopener noreferrer">Recipient address on the testnet explorer<ExternalLink size={12} aria-hidden="true" /></a> (an address page, not transaction status). Compare the recipient with your wallet's request before approving.</p>
          <div className="wlt-actions">
            <button type="button" className="wlt-btn wlt-btn--primary" onClick={() => void confirmSend()} disabled={inBaselineFetching || !gate.allowed} aria-busy={inBaselineFetching}>
              {inBaselineFetching ? <LoaderCircle className="wlt-spin" size={15} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
              {inBaselineFetching ? 'Fetching baseline…' : 'Confirm in wallet'}
            </button>
            <button type="button" className="wlt-btn wlt-btn--quiet" onClick={backToEdit} disabled={inBaselineFetching}>Edit</button>
          </div>
        </div>
      )}

      {inBaselineFailed && reviewData && (
        <div className="ton-review" role="group" aria-labelledby="ton-review-title">
          <h3 id="ton-review-title" ref={reviewHeading} tabIndex={-1}>Baseline unavailable</h3>
          <div className="ton-error is-warn" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            <div><strong>Automatic confirmation tracking unavailable</strong><p>{flow.baselineFailureMessage}</p></div>
          </div>
          <div className="wlt-actions">
            <button type="button" className="wlt-btn wlt-btn--primary" onClick={() => void handleSendWithoutTracking()} disabled={!gate.allowed}>
              <Send size={15} aria-hidden="true" />Send without tracking
            </button>
            <button type="button" className="wlt-btn wlt-btn--quiet" onClick={backToEdit}>Cancel</button>
          </div>
        </div>
      )}

      {inPending && reviewData && (
        <div className="ton-review" role="group" aria-labelledby="ton-review-title" aria-busy>
          <h3 id="ton-review-title" ref={reviewHeading} tabIndex={-1}>Waiting for wallet</h3>
          <dl className="ton-review__list">
            <div><dt>Recipient</dt><dd><code>{reviewData.recipient}</code></dd></div>
            <div><dt>Amount</dt><dd><strong>{formatNanoTon(reviewData.amountNano)} TON</strong></dd></div>
          </dl>
          <div className="wlt-actions">
            <button type="button" className="wlt-btn wlt-btn--primary" disabled aria-busy>
              <LoaderCircle className="wlt-spin" size={15} aria-hidden="true" />Waiting for your wallet.
            </button>
          </div>
          <p className="ton-field__hint">Approve or cancel the request in your wallet. It expires after 5 minutes.</p>
        </div>
      )}

      {inConfirming && reviewData && (
        <div className="ton-review" role="group" aria-labelledby="ton-review-title" aria-busy>
          <h3 id="ton-review-title" ref={reviewHeading} tabIndex={-1}>Confirming on-chain</h3>
          <dl className="ton-review__list">
            <div><dt>Recipient</dt><dd><code>{reviewData.recipient}</code></dd></div>
            <div><dt>Amount</dt><dd><strong>{formatNanoTon(reviewData.amountNano)} TON</strong></dd></div>
          </dl>
          <div className="wlt-actions">
            <button type="button" className="wlt-btn wlt-btn--primary" disabled aria-busy>
              <LoaderCircle className="wlt-spin" size={15} aria-hidden="true" />Checking for on-chain confirmation…
            </button>
          </div>
          <p className="ton-field__hint">NEXORA is polling for your transfer on testnet (up to 60 s). Wallet acceptance is not the same as on-chain confirmation.</p>
        </div>
      )}

      <p className="ton-field__hint">Testnet only: mainnet and unknown networks are blocked. NEXORA tracks confirmation automatically when the baseline is available; check your wallet or a testnet explorer if tracking is unavailable.</p>
    </div>
  )
}
