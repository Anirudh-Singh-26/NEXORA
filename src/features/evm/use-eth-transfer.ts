import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useSendTransaction } from 'wagmi'
import { useWallet } from '@/features/wallet-provider'
import { SEPOLIA_CHAIN_ID } from '@/lib/network/testnet'
import { checkEthAffordability, maxFee, maxSendable, parseEthAmount, validateEthRecipient, type EthChainSnapshot } from '@/lib/eth-transfer/amount'
import { createSepoliaReader, fetchEthSnapshot, TX_HASH_PATTERN, type EthReader } from '@/lib/eth-transfer/client'
import { classifyEthError } from '@/lib/eth-transfer/errors'
import { ethTransferReducer, initialEthTransferState } from '@/lib/eth-transfer/flow'
import { evaluateEthSendGate } from '@/lib/eth-transfer/gate'
import { submitEthTransfer } from '@/lib/eth-transfer/submit'

const POLL_INTERVAL_MS = 4_000
const POLL_WINDOW_MS = 120_000

export type EthInfoState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; snapshot: EthChainSnapshot }
  | { status: 'error'; message: string }

/**
 * Everything the ETH send panel needs: the Sepolia gate, a fresh balance/fee snapshot, validation, the review → wallet →
 * confirmation flow, and the duplicate-submission lock. The connected wallet (through Reown AppKit's wagmi connector)
 * shows, signs and broadcasts the transaction; NEXORA never sees a key and never fabricates a result: success is shown
 * only after a Sepolia receipt with status "success" is read. `onSettled` fires once the transfer reaches a final state.
 */
export function useEthTransfer(onSettled: () => void) {
  const wallet = useWallet()
  const { mutateAsync: sendTransaction } = useSendTransaction()
  const [state, dispatch] = useReducer(ethTransferReducer, initialEthTransferState)
  const [info, setInfo] = useState<EthInfoState>({ status: 'idle' })
  const [checking, setChecking] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const sending = useRef(false)
  const mounted = useRef(true)
  const readerRef = useRef<EthReader | null>(null)
  const settledRef = useRef(onSettled)
  useEffect(() => { settledRef.current = onSettled }, [onSettled])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const reader = () => (readerRef.current ??= createSepoliaReader())

  const gate = evaluateEthSendGate({ address: wallet.evmAddress, chainId: wallet.chainId, restoring: wallet.isEvmRestoring })
  const ownAddress = gate.allowed ? gate.address : null
  // The gate is re-read at the moment of use through a ref, so a network change during review is caught.
  const gateRef = useRef(gate)
  useEffect(() => { gateRef.current = gate }, [gate])

  const loadInfo = useCallback(async () => {
    if (!ownAddress) { setInfo({ status: 'idle' }); return }
    setInfo({ status: 'loading' })
    try {
      const snapshot = await fetchEthSnapshot(reader(), ownAddress, null, 0n)
      if (mounted.current) setInfo({ status: 'ready', snapshot })
    } catch (error) {
      if (mounted.current) setInfo({ status: 'error', message: classifyEthError(error).message })
    }
  }, [ownAddress])

  // Stop a review that the network or account no longer supports. Never interrupts a request already with the wallet.
  useEffect(() => {
    if (!gate.allowed && state.phase === 'reviewing') dispatch({ type: 'abort', message: `${gate.message} The review was cancelled. Nothing was sent.` })
  }, [gate, state.phase])

  const recipientCheck = useCallback((text: string) => validateEthRecipient(text, ownAddress), [ownAddress])
  const amountCheck = useCallback((text: string) => parseEthAmount(text), [])
  const snapshot = info.status === 'ready' ? info.snapshot : null
  const maxWei = useMemo(() => maxSendable(snapshot), [snapshot])

  /** Validates both fields against fresh Sepolia data (including a fee estimate for this exact transfer) and opens the review. */
  const startReview = useCallback(async (recipientText: string, amountText: string) => {
    setReviewError(null)
    const recipient = validateEthRecipient(recipientText, ownAddress)
    const amount = parseEthAmount(amountText)
    if (!ownAddress || !gateRef.current.allowed || !recipient.ok || !amount.ok || sending.current) return
    setChecking(true)
    try {
      const fresh = await fetchEthSnapshot(reader(), ownAddress, recipient.address, amount.wei)
      if (!mounted.current) return
      setInfo({ status: 'ready', snapshot: fresh })
      const problem = checkEthAffordability(amount.wei, fresh)
      if (problem) { setReviewError(problem); return }
      dispatch({ type: 'review', review: { recipient: recipient.address, wei: amount.wei, maxFeeWei: maxFee(fresh) } })
    } catch (error) {
      if (mounted.current) setReviewError(classifyEthError(error).message)
    } finally {
      if (mounted.current) setChecking(false)
    }
  }, [ownAddress])

  /** Asks the wallet to sign and broadcast. A second call while one is running is ignored. */
  const confirm = useCallback(async () => {
    const review = state.review
    if (sending.current || state.phase !== 'reviewing' || !review || !ownAddress) return
    sending.current = true
    dispatch({ type: 'send' })
    try {
      const outcome = await submitEthTransfer({
        gateMessage: () => { const g = gateRef.current; return g.allowed ? null : g.message },
        snapshot: (intent) => fetchEthSnapshot(reader(), intent.from, intent.to, intent.wei),
        // chainId pins the request to Sepolia: wagmi refuses (ConnectorChainMismatchError) if the wallet is elsewhere.
        send: (intent) => sendTransaction({ to: intent.to, value: intent.wei, chainId: SEPOLIA_CHAIN_ID }),
      }, { from: ownAddress, to: review.recipient, wei: review.wei })
      if (mounted.current) dispatch({ type: 'outcome', outcome })
    } finally {
      sending.current = false
    }
  }, [state.phase, state.review, ownAddress, sendTransaction])

  // Confirmation tracking: poll the receipt until it settles or the window ends.
  const submitted = state.submitted
  useEffect(() => {
    if (state.phase !== 'confirming' || !submitted || !TX_HASH_PATTERN.test(submitted.hash)) return
    let cancelled = false
    const startedAt = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      try {
        const next = await reader().receiptState(submitted.hash)
        if (cancelled) return
        dispatch({ type: 'poll', state: next })
        if (next !== 'pending') { settledRef.current(); return }
      } catch { /* a failed read is retried until the window ends */ }
      if (cancelled) return
      if (Date.now() - startedAt >= POLL_WINDOW_MS) { dispatch({ type: 'poll-timeout' }); return }
      timer = setTimeout(() => void tick(), POLL_INTERVAL_MS)
    }
    void tick()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [state.phase, submitted])

  return {
    gate, state, info, snapshot, maxWei, checking, reviewError, clearReviewError: () => setReviewError(null),
    loadInfo, recipientCheck, amountCheck, startReview, confirm,
    back: () => dispatch({ type: 'back' }),
    dismiss: () => dispatch({ type: 'dismiss' }),
    resumeConfirming: () => dispatch({ type: 'resume-confirming' }),
  }
}
