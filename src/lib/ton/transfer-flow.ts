import type { TonTransferOutcome } from './transfer.ts'
import { type TonConfirmationResult, tonTxExplorerUrl } from './confirmation.ts'
import type { TrackedMessage } from './confirmation.ts'

/**
 * Pure state machine for editing, reviewing, baseline-fetching, pending, confirming, and the
 * resulting notices. No React, no I/O. All terminal confirmation outcomes (confirmed,
 * on-chain-failed, execution-unknown, confirmation-unknown) return to 'editing' with a notice;
 * a retryContext is preserved for statuses where the user may want to retry the lookup without
 * re-submitting the transfer.
 */

export type TonTransferNotice = { tone: 'success' | 'info' | 'error'; message: string; explorerUrl: string | null }

export interface TonTransferReview { recipient: string; amountNano: bigint }

/** Context preserved across confirmation retries; never causes a re-send. */
export interface TonRetryContext {
  senderAddress: string
  baselineLt: bigint
  recipient: string
  amountNano: bigint
  /**
   * TEP-467 tracking identity derived from the TON Connect response BOC.
   * Null when the BOC was not parseable; the lookup falls back to the (recipient, amount) heuristic.
   */
  tracked: TrackedMessage | null
}

export type TonTransferFlowPhase =
  | 'editing'
  | 'reviewing'
  | 'baseline-fetching'
  | 'baseline-failed'
  | 'pending'
  | 'confirming'

export interface TonTransferFlowState {
  phase: TonTransferFlowPhase
  review: TonTransferReview | null
  baselineLt: bigint | null
  baselineFailureMessage: string | null
  notice: TonTransferNotice | null
  retryContext: TonRetryContext | null
  /** Number of lookup attempts made for this submission (0 = first attempt). */
  lookupAttempt: number
}

export type TonTransferFlowAction =
  | { type: 'review';             review: TonTransferReview }
  | { type: 'back' }
  | { type: 'dismiss' }
  | { type: 'abort';              message: string }
  | { type: 'fetch-baseline' }
  | { type: 'baseline-ok';        baselineLt: bigint }
  | { type: 'baseline-fail';      message: string }
  | { type: 'send-without-tracking' }
  | { type: 'outcome';            outcome: TonTransferOutcome }
  | { type: 'start-confirming';   senderAddress: string; tracked: TrackedMessage | null }
  | { type: 'confirmation';       result: TonConfirmationResult }
  | { type: 'retry-confirmation' }

export const initialTonTransferFlow: TonTransferFlowState = {
  phase: 'editing', review: null, baselineLt: null, baselineFailureMessage: null, notice: null, retryContext: null, lookupAttempt: 0,
}

/** Shown when the user sent without automatic tracking (baseline unavailable). */
export const TON_TRANSFER_SUBMITTED_MESSAGE = 'Your wallet accepted the request. Automatic confirmation tracking was unavailable, so check your wallet\u2019s history or the testnet explorer to verify the result.'

export function confirmationNotice(result: TonConfirmationResult): TonTransferNotice {
  switch (result.status) {
    case 'confirmed':
      return { tone: 'success', message: 'Your transfer was confirmed on-chain and executed successfully.', explorerUrl: tonTxExplorerUrl(result.hash) }
    case 'on-chain-failed':
      return { tone: 'error', message: result.stage === 'delivery' ? 'Your transfer was recorded on-chain but the recipient could not be reached (bounce or delivery failed). Check the testnet explorer for details.' : 'Your transfer was recorded on-chain but execution failed. Check the testnet explorer for details.', explorerUrl: tonTxExplorerUrl(result.hash) }
    case 'execution-unknown':
      return { tone: 'info', message: 'A matching transfer was found on-chain, but its execution status could not be determined from the available data. Check the testnet explorer to verify.', explorerUrl: tonTxExplorerUrl(result.hash) }
    case 'confirmation-unknown':
      if (result.reason === 'ambiguous')
        return { tone: 'info', message: 'NEXORA found more than one transfer matching the recipient and amount in the tracking window and cannot determine which belongs to this request. Check the testnet explorer to verify.', explorerUrl: null }
      if (result.reason === 'unavailable')
        return { tone: 'info', message: 'The TON testnet data service could not be reached during confirmation tracking. Check your connection and try again.', explorerUrl: null }
      if (result.reason === 'delivery-pending')
        return { tone: 'info', message: 'Your transfer was found on-chain but delivery to the recipient is unverified. Check the testnet explorer to confirm the final status.', explorerUrl: 'hash' in result ? tonTxExplorerUrl((result as { hash: string }).hash) : null }
      // timeout
      return { tone: 'info', message: 'NEXORA could not find your transfer on-chain within the tracking window. This does not mean the transfer failed — it may still be processed. Check your wallet or the testnet explorer.', explorerUrl: null }
  }
}

export function tonTransferFlowReducer(state: TonTransferFlowState, action: TonTransferFlowAction): TonTransferFlowState {
  switch (action.type) {
    case 'review':
      if (state.phase === 'pending' || state.phase === 'baseline-fetching' || state.phase === 'confirming') return state
      return { phase: 'reviewing', review: action.review, baselineLt: null, baselineFailureMessage: null, notice: null, retryContext: null, lookupAttempt: 0 }

    case 'back':
      if (state.phase === 'reviewing')      return { phase: 'editing', review: null, baselineLt: null, baselineFailureMessage: null, notice: null, retryContext: state.retryContext, lookupAttempt: state.lookupAttempt }
      if (state.phase === 'baseline-failed') return { ...state, phase: 'reviewing', baselineFailureMessage: null }
      return state

    case 'fetch-baseline':
      if (state.phase !== 'reviewing' || !state.review) return state
      return { ...state, phase: 'baseline-fetching' }

    case 'baseline-ok':
      if (state.phase !== 'baseline-fetching') return state
      return { ...state, phase: 'pending', baselineLt: action.baselineLt }

    case 'baseline-fail':
      if (state.phase !== 'baseline-fetching') return state
      return { ...state, phase: 'baseline-failed', baselineFailureMessage: action.message }

    case 'send-without-tracking':
      if (state.phase !== 'baseline-failed') return state
      return { ...state, phase: 'pending', baselineLt: null, baselineFailureMessage: null }

    case 'outcome':
      if (state.phase !== 'pending') return state
      if (action.outcome.status === 'submitted')
        return { phase: 'editing', review: null, baselineLt: null, baselineFailureMessage: null, notice: { tone: 'success', message: TON_TRANSFER_SUBMITTED_MESSAGE, explorerUrl: null }, retryContext: null, lookupAttempt: 0 }
      return { phase: 'editing', review: null, baselineLt: null, baselineFailureMessage: null,
               notice: { tone: action.outcome.status === 'rejected' ? 'info' : 'error', message: action.outcome.message, explorerUrl: null },
               retryContext: null, lookupAttempt: 0 }

    case 'start-confirming': {
      if (state.phase !== 'pending' || !state.review || state.baselineLt === null) return state
      const retryContext: TonRetryContext = {
        senderAddress: action.senderAddress, baselineLt: state.baselineLt,
        recipient: state.review.recipient, amountNano: state.review.amountNano, tracked: action.tracked,
      }
      return { ...state, phase: 'confirming', retryContext }
    }

    case 'confirmation': {
      if (state.phase !== 'confirming') return state
      const notice = confirmationNotice(action.result)
      const keepRetry = action.result.status === 'confirmation-unknown' || action.result.status === 'execution-unknown'
      return { phase: 'editing', review: null, baselineLt: null, baselineFailureMessage: null, notice, retryContext: keepRetry ? state.retryContext : null, lookupAttempt: 0 }
    }

    case 'retry-confirmation':
      if (state.phase !== 'editing' || !state.retryContext) return state
      return { ...state, phase: 'confirming', notice: null, lookupAttempt: state.lookupAttempt + 1 }

    case 'abort':
      if (state.phase === 'pending' || state.phase === 'confirming') return state
      return { phase: 'editing', review: null, baselineLt: null, baselineFailureMessage: null, notice: { tone: 'error', message: action.message, explorerUrl: null }, retryContext: null, lookupAttempt: 0 }

    case 'dismiss':
      return state.notice ? { ...state, notice: null } : state
  }
}
