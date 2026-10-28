import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useAppKitProvider } from '@reown/appkit/react'
import { useWallet } from '@/features/wallet-provider'
import { signSolTransfer } from '@/features/solana/solana-signer'
import { checkAffordability, parseSolAmount, validateSolRecipient, maxSendable, type ChainSnapshot } from '@/lib/solana-transfer/amount'
import { fetchPrepare, fetchSignatureState, relaySignedTransaction, type PreparedTransfer } from '@/lib/solana-transfer/client'
import { classifyTransferError } from '@/lib/solana-transfer/errors'
import { initialSolTransferState, solTransferReducer } from '@/lib/solana-transfer/flow'
import { evaluateSolSendGate } from '@/lib/solana-transfer/gate'
import { resolveSigner } from '@/lib/solana-transfer/provider'
import { submitSolTransfer } from '@/lib/solana-transfer/submit'

const POLL_INTERVAL_MS = 2_000
const POLL_WINDOW_MS = 60_000

export type InfoState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; snapshot: ChainSnapshot }
  | { status: 'error'; message: string }

/**
 * Everything the SOL send panel needs: the network gate, a fresh Devnet balance/fee snapshot, validation, the review →
 * wallet → relay → confirmation flow, and the duplicate-submission lock. Signing happens in the connected wallet through
 * Reown's Solana provider; NEXORA never sees a key. `onSettled` fires once the transfer reaches a final state so the
 * balance and activity can be refreshed.
 */
export function useSolanaTransfer(onSettled: () => void) {
  const wallet = useWallet()
  const { walletProvider } = useAppKitProvider('solana')
  const [state, dispatch] = useReducer(solTransferReducer, initialSolTransferState)
  const [info, setInfo] = useState<InfoState>({ status: 'idle' })
  const [checking, setChecking] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const sending = useRef(false)
  const mounted = useRef(true)
  const settledRef = useRef(onSettled)
  useEffect(() => { settledRef.current = onSettled }, [onSettled])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const gate = evaluateSolSendGate({ address: wallet.solanaAddress, networkName: wallet.solanaNetworkName, restoring: wallet.isSolanaRestoring })
  const ownAddress = gate.allowed ? gate.address : null
  // The gate is re-read at the moment of use through a ref, so a network change during review is caught.
  const gateRef = useRef(gate)
  useEffect(() => { gateRef.current = gate }, [gate])
  const providerRef = useRef<unknown>(walletProvider)
  useEffect(() => { providerRef.current = walletProvider }, [walletProvider])

  const loadInfo = useCallback(async () => {
    if (!ownAddress) { setInfo({ status: 'idle' }); return }
    setInfo({ status: 'loading' })
    try {
      const prepared = await fetchPrepare(ownAddress, null)
      if (mounted.current) setInfo({ status: 'ready', snapshot: { balance: prepared.balance, fee: prepared.fee, rentExemptMinimum: prepared.rentExemptMinimum, recipientBalance: null } })
    } catch (error) {
      if (mounted.current) setInfo({ status: 'error', message: classifyTransferError(error).message })
    }
  }, [ownAddress])

  // Stop a review that the network or account no longer supports. Never interrupts a request already with the wallet.
  useEffect(() => {
    if (!gate.allowed && state.phase === 'reviewing') dispatch({ type: 'abort', message: `${gate.message} The review was cancelled. Nothing was sent.` })
  }, [gate, state.phase])

  const recipientCheck = useCallback((text: string) => validateSolRecipient(text, ownAddress), [ownAddress])
  const amountCheck = useCallback((text: string) => parseSolAmount(text), [])
  const snapshot = info.status === 'ready' ? info.snapshot : null
  const maxLamports = useMemo(() => (snapshot ? maxSendable(snapshot.balance, snapshot.fee) : null), [snapshot])

  /** Validates both fields against fresh Devnet data (including whether the recipient account exists) and opens the review. */
  const startReview = useCallback(async (recipientText: string, amountText: string) => {
    setReviewError(null)
    const recipient = validateSolRecipient(recipientText, ownAddress)
    const amount = parseSolAmount(amountText)
    if (!ownAddress || !gateRef.current.allowed || !recipient.ok || !amount.ok || sending.current) return
    setChecking(true)
    try {
      const prepared = await fetchPrepare(ownAddress, recipient.address)
      if (!mounted.current) return
      const fresh: ChainSnapshot = { balance: prepared.balance, fee: prepared.fee, rentExemptMinimum: prepared.rentExemptMinimum, recipientBalance: prepared.recipientBalance }
      setInfo({ status: 'ready', snapshot: { ...fresh, recipientBalance: null } })
      const problem = checkAffordability(amount.lamports, fresh)
      if (problem) { setReviewError(problem); return }
      dispatch({ type: 'review', review: { recipient: recipient.address, lamports: amount.lamports } })
    } catch (error) {
      if (mounted.current) setReviewError(classifyTransferError(error).message)
    } finally {
      if (mounted.current) setChecking(false)
    }
  }, [ownAddress])

  /** Asks the wallet to sign and relays to Devnet. A second call while one is running is ignored. */
  const confirm = useCallback(async () => {
    const review = state.review
    if (sending.current || state.phase !== 'reviewing' || !review || !ownAddress) return
    sending.current = true
    dispatch({ type: 'send' })
    try {
      const outcome = await submitSolTransfer({
        gateMessage: () => { const g = gateRef.current; return g.allowed ? null : g.message },
        prepare: (from: string, to: string): Promise<PreparedTransfer> => fetchPrepare(from, to),
        sign: (intent, prepared) => signSolTransfer(resolveSigner(providerRef.current, ownAddress), intent, prepared),
        relay: (signed) => relaySignedTransaction(signed),
      }, { from: ownAddress, to: review.recipient, lamports: review.lamports })
      if (mounted.current) dispatch({ type: 'outcome', outcome })
    } finally {
      sending.current = false
    }
  }, [state.phase, state.review, ownAddress])

  // Confirmation tracking: poll the signature's state until it settles or the window ends.
  const submitted = state.submitted
  useEffect(() => {
    if (state.phase !== 'confirming' || !submitted) return
    let cancelled = false
    const controller = new AbortController()
    const startedAt = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      try {
        const next = await fetchSignatureState(submitted.signature, submitted.lastValidBlockHeight, { signal: controller.signal })
        if (cancelled) return
        dispatch({ type: 'poll', state: next })
        if (next === 'confirmed' || next === 'finalized' || next === 'failed' || next === 'expired') { settledRef.current(); return }
      } catch { /* a failed status read is retried until the window ends */ }
      if (cancelled) return
      if (Date.now() - startedAt >= POLL_WINDOW_MS) { dispatch({ type: 'poll-timeout' }); return }
      timer = setTimeout(() => void tick(), POLL_INTERVAL_MS)
    }
    void tick()
    return () => { cancelled = true; controller.abort(); if (timer) clearTimeout(timer) }
  }, [state.phase, submitted])

  return {
    gate, state, info, snapshot, maxLamports, checking, reviewError, clearReviewError: () => setReviewError(null),
    loadInfo, recipientCheck, amountCheck, startReview, confirm,
    back: () => dispatch({ type: 'back' }),
    dismiss: () => dispatch({ type: 'dismiss' }),
    resumeConfirming: () => dispatch({ type: 'resume-confirming' }),
  }
}
