import { useEffect, useRef } from 'react'
import {
  fetchRecentTransactions,
  findMatchingTx,
  lookupTransfer,
  POLL_INTERVAL_MS,
  POLL_MAX_ATTEMPTS,
  type TonConfirmationResult,
  type TrackedMessage,
} from '@/lib/ton/confirmation'
import { tonCodec } from '@/lib/ton/confirmation-codec'

export interface UseTonTransferConfirmationOptions {
  enabled: boolean
  senderAddress: string | null
  baselineLt: bigint | null
  recipient: string | null
  amountNano: bigint | null
  tracked?: TrackedMessage | null
  bodyHash?: string | null
  apiBase: string
  onResult: (result: TonConfirmationResult) => void
}

/**
 * Polls getTransactions for the sender's address until a matching transaction is found or the
 * attempt ceiling is reached. Polling is bounded (POLL_MAX_ATTEMPTS × POLL_INTERVAL_MS = 60 s),
 * non-overlapping (awaits each fetch before scheduling the next), and cleans up on unmount or
 * when `enabled` becomes false.
 *
 * Transient API errors are counted and do not abort polling early; only exhausting all attempts
 * triggers the timeout result. Callers must never treat a timeout as proof of failure.
 */
export function useTonTransferConfirmation({
  enabled, senderAddress, baselineLt, recipient, amountNano, tracked, bodyHash, apiBase, onResult,
}: UseTonTransferConfirmationOptions): void {
  const onResultRef = useRef(onResult)
  // Keep ref up‑to‑date after render
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    if (!enabled || senderAddress === null || baselineLt === null || recipient === null || amountNano === null) return

    const controller  = new AbortController()
    let attempts      = 0
    let timerId: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      if (controller.signal.aborted) return

      try {
        if (tracked) {
          const res = await lookupTransfer(tracked, baselineLt!, { base: apiBase, signal: controller.signal, codec: tonCodec })
          if (controller.signal.aborted) return
          if (res.state === 'success') {
            const { lt, hash, executionResult } = res
            if (executionResult === 'success') {
              onResultRef.current({ status: 'confirmed', lt, hash, executionResult: 'success' })
              return
            }
            if (executionResult === 'failed') {
              onResultRef.current({ status: 'on-chain-failed', lt, hash, executionResult: 'failed', stage: 'wallet' })
              return
            }
            onResultRef.current({ status: 'execution-unknown', lt, hash, executionResult: 'unknown' })
            return
          }
        }

        const results = await fetchRecentTransactions(senderAddress!, { base: apiBase, signal: controller.signal })
        if (controller.signal.aborted) return

        const match = findMatchingTx(results, baselineLt!, recipient!, amountNano!, bodyHash ?? null)

        if (!match.found && match.ambiguous) {
          if (!controller.signal.aborted) onResultRef.current({ status: 'confirmation-unknown', reason: 'ambiguous' })
          return
        }
        if (match.found) {
          if (controller.signal.aborted) return
          const { lt, hash, executionResult } = match
          if (executionResult === 'success')       onResultRef.current({ status: 'confirmed',         lt, hash, executionResult: 'success' })
          else if (executionResult === 'failed')   onResultRef.current({ status: 'on-chain-failed',   lt, hash, executionResult: 'failed', stage: 'wallet' })
          else                                     onResultRef.current({ status: 'execution-unknown', lt, hash, executionResult: 'unknown' })
          return
        }
      } catch {
        if (controller.signal.aborted) return
        // Transient errors (network, rate-limit, etc.) count toward the attempt ceiling but do not abort early.
      }

      attempts++
      if (attempts >= POLL_MAX_ATTEMPTS) {
        if (!controller.signal.aborted) onResultRef.current({ status: 'confirmation-unknown', reason: 'timeout' })
        return
      }
      if (!controller.signal.aborted) timerId = setTimeout(poll, POLL_INTERVAL_MS)
    }

    timerId = setTimeout(poll, POLL_INTERVAL_MS)
    return () => { controller.abort(); if (timerId !== null) clearTimeout(timerId) }
  }, [enabled, senderAddress, baselineLt, recipient, amountNano, tracked, bodyHash, apiBase])
}
