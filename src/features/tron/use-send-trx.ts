import { useCallback, useEffect, useRef, useState } from 'react'
import { useTronWallet } from '@/features/tron/tron-provider'
import {
  broadcastShastaTransaction, buildShastaTransfer, evaluateSendGate, fetchShastaTxStatus, TransferError, verifySignedMatches,
  type TransferIntent, type TxStatus,
} from '@/lib/tron/transfer'

export type SendPhase = 'idle' | 'building' | 'awaiting-wallet' | 'broadcasting'

export interface SubmittedTransfer {
  txId: string
  expiration: number
  intent: TransferIntent
  status: TxStatus | null
  checking: boolean
  statusError: string | null
  /** True once automatic polling has stopped without a final answer; the manual check still works. */
  pollingStopped: boolean
}

const POLL_MS = 3000
const MAX_POLLS = 100 // about five minutes
const FINAL = new Set<TxStatus['state']>(['confirmed', 'failed', 'not-found'])

function messageOf(error: unknown): string {
  if (error instanceof TransferError) return error.message
  return error instanceof Error && error.message ? error.message.slice(0, 180) : 'Something went wrong. Nothing was sent.'
}

/**
 * Drives one native TRX transfer on Shasta: build + verify → fresh network gate → wallet signature → broadcast → real
 * status polling. A ref lock makes a second submit impossible while one is in flight, and every request and timer is
 * cancelled on unmount.
 */
export function useSendTrx(onSettled: () => void) {
  const tron = useTronWallet()
  const tronRef = useRef(tron)
  tronRef.current = tron
  const settledRef = useRef(onSettled)
  settledRef.current = onSettled

  const [phase, setPhase] = useState<SendPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<SubmittedTransfer | null>(null)
  const [pollNonce, setPollNonce] = useState(0)
  const lock = useRef(false)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => { abort.current?.abort() }, [])

  const gateNow = useCallback((sender: string) => {
    const t = tronRef.current
    return evaluateSendGate({ connected: t.status === 'connected', address: t.address, expectedSender: sender, identity: t.network.status === 'ready' ? t.network.identity : null })
  }, [])

  const send = useCallback(async (intent: TransferIntent) => {
    if (lock.current) return
    lock.current = true
    setError(null)
    const controller = new AbortController()
    abort.current = controller
    try {
      const first = gateNow(intent.sender)
      if (!first.ok) throw new TransferError('wallet', first.message)
      setPhase('building')
      const unsigned = await buildShastaTransfer(intent, { signal: controller.signal })
      const second = gateNow(intent.sender) // state may have changed while the node was building
      if (!second.ok) throw new TransferError('wallet', second.message)
      setPhase('awaiting-wallet')
      const signed = await tronRef.current.signShastaTransfer(unsigned, intent.sender) // re-reads the wallet itself before signing
      verifySignedMatches(unsigned, signed)
      setPhase('broadcasting')
      const { txId } = await broadcastShastaTransaction(signed, { signal: controller.signal })
      setSubmitted({ txId, expiration: unsigned.raw_data.expiration, intent, status: null, checking: false, statusError: null, pollingStopped: false })
    } catch (sendError) {
      if (!(sendError instanceof DOMException && sendError.name === 'AbortError')) setError(messageOf(sendError))
    } finally {
      setPhase('idle')
      lock.current = false
    }
  }, [gateNow])

  const txId = submitted?.txId ?? null
  const expiration = submitted?.expiration ?? 0
  useEffect(() => {
    if (!txId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const tick = async () => {
      setSubmitted((s) => (s && s.txId === txId ? { ...s, checking: true, pollingStopped: false } : s))
      let final = false
      try {
        const status = await fetchShastaTxStatus(txId, expiration, { signal: controller.signal })
        if (controller.signal.aborted) return
        final = FINAL.has(status.state)
        setSubmitted((s) => (s && s.txId === txId ? { ...s, status, statusError: null } : s))
      } catch (statusError) {
        if (controller.signal.aborted) return
        setSubmitted((s) => (s && s.txId === txId ? { ...s, statusError: messageOf(statusError) } : s))
      }
      attempts += 1
      const stop = final || attempts >= MAX_POLLS
      setSubmitted((s) => (s && s.txId === txId ? { ...s, checking: false, pollingStopped: stop && !final } : s))
      if (!stop) timer = setTimeout(() => { void tick() }, POLL_MS)
    }
    void tick()
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
  }, [txId, expiration, pollNonce])

  // Once Shasta has the transaction in a block (or it failed), the sender's balance has changed: re-read it.
  const state = submitted?.status?.state ?? null
  useEffect(() => {
    if (state === 'included' || state === 'confirmed' || state === 'failed') settledRef.current()
  }, [state, txId])

  const checkNow = useCallback(() => setPollNonce((n) => n + 1), [])
  const reset = useCallback(() => { setSubmitted(null); setError(null) }, [])
  return { phase, error, submitted, send, checkNow, reset, clearError: () => setError(null) }
}
