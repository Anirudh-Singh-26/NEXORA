/**
 * Pure state machine for the SOL send panel: editing → reviewing → sending (wallet + relay) → confirming → editing with
 * a notice. No React, no I/O. A second 'send' while one is in flight is ignored, which is what prevents duplicate
 * submissions; a submitted transfer is never re-sent by any action here.
 */
import { solanaDevnetTxUrl } from '../network/testnet.ts'
import type { SignatureState } from './client.ts'
import type { SubmitOutcome } from './submit.ts'

export interface SolTransferReview { recipient: string; lamports: bigint }
export interface SolSubmitted { signature: string; lastValidBlockHeight: number; recipient: string; lamports: bigint; fee: bigint }

export type SolTransferNotice = { tone: 'success' | 'info' | 'error'; message: string; explorerUrl: string | null; signature: string | null }

export type SolTransferPhase = 'editing' | 'reviewing' | 'sending' | 'confirming'

export interface SolTransferState {
  phase: SolTransferPhase
  review: SolTransferReview | null
  submitted: SolSubmitted | null
  /** Latest signature state seen while confirming. */
  chainState: SignatureState | null
  notice: SolTransferNotice | null
}

export type SolTransferAction =
  | { type: 'review'; review: SolTransferReview }
  | { type: 'back' }
  | { type: 'send' }
  | { type: 'outcome'; outcome: SubmitOutcome }
  | { type: 'poll'; state: SignatureState }
  | { type: 'poll-timeout' }
  | { type: 'resume-confirming' }
  | { type: 'abort'; message: string }
  | { type: 'dismiss' }

export const initialSolTransferState: SolTransferState = { phase: 'editing', review: null, submitted: null, chainState: null, notice: null }

const FINAL_OK: ReadonlySet<SignatureState> = new Set(['confirmed', 'finalized'])

function noticeFor(submitted: SolSubmitted, state: SignatureState | 'timeout'): SolTransferNotice {
  const explorerUrl = solanaDevnetTxUrl(submitted.signature)
  const base = { explorerUrl, signature: submitted.signature }
  switch (state) {
    case 'finalized': return { tone: 'success', message: 'Your transfer is finalized on Solana Devnet.', ...base }
    case 'confirmed': return { tone: 'success', message: 'Your transfer is confirmed on Solana Devnet (not yet finalized).', ...base }
    case 'failed': return { tone: 'error', message: 'The transaction was recorded on Devnet but failed, so the SOL was not transferred (only the network fee was charged). Check the explorer for details.', ...base }
    case 'expired': return { tone: 'error', message: 'The transaction expired before it reached a block, so it will never be processed and no SOL moved. You can try again.', ...base }
    case 'timeout': return { tone: 'info', message: 'Not confirmed yet. NEXORA stopped waiting after about a minute, which does not mean it failed: it may still land. Check the explorer, or look it up again.', ...base }
    case 'processed':
    case 'not-found': return { tone: 'info', message: 'Submitted to Devnet; waiting for confirmation.', ...base }
  }
}

export function solTransferReducer(state: SolTransferState, action: SolTransferAction): SolTransferState {
  switch (action.type) {
    case 'review':
      if (state.phase === 'sending' || state.phase === 'confirming') return state
      return { ...initialSolTransferState, phase: 'reviewing', review: action.review }
    case 'back':
      return state.phase === 'reviewing' ? { ...initialSolTransferState } : state
    case 'send':
      if (state.phase !== 'reviewing' || !state.review) return state // duplicate or out-of-order sends are ignored
      return { ...state, phase: 'sending', notice: null }
    case 'outcome': {
      if (state.phase !== 'sending' || !state.review) return state
      const { outcome } = action
      if (outcome.status === 'blocked') return { ...initialSolTransferState, notice: { tone: 'error', message: `${outcome.message} Nothing was sent.`, explorerUrl: null, signature: null } }
      if (outcome.status === 'failed') {
        const tone = outcome.failure.kind === 'user-rejected' ? 'info' : 'error'
        const extra = outcome.afterSigning && outcome.failure.kind !== 'blockhash-expired' ? ' Your wallet already signed this transaction, so check the explorer or your wallet history before trying again.' : ''
        return { ...initialSolTransferState, notice: { tone, message: `${outcome.failure.message}${extra}`, explorerUrl: null, signature: null } }
      }
      const submitted: SolSubmitted = { signature: outcome.signature, lastValidBlockHeight: outcome.lastValidBlockHeight, recipient: state.review.recipient, lamports: state.review.lamports, fee: outcome.fee }
      return { phase: 'confirming', review: null, submitted, chainState: null, notice: null }
    }
    case 'poll': {
      if (state.phase !== 'confirming' || !state.submitted) return state
      const done = FINAL_OK.has(action.state) || action.state === 'failed' || action.state === 'expired'
      if (!done) return { ...state, chainState: action.state }
      // Finalized and terminal failures end tracking; 'confirmed' also ends it (the notice says it is not yet finalized).
      return { ...initialSolTransferState, submitted: state.submitted, chainState: action.state, notice: noticeFor(state.submitted, action.state) }
    }
    case 'poll-timeout':
      if (state.phase !== 'confirming' || !state.submitted) return state
      return { ...initialSolTransferState, submitted: state.submitted, chainState: state.chainState, notice: noticeFor(state.submitted, 'timeout') }
    case 'resume-confirming':
      if (state.phase !== 'editing' || !state.submitted) return state
      return { ...state, phase: 'confirming', notice: null }
    case 'abort':
      if (state.phase === 'sending' || state.phase === 'confirming') return state
      return { ...initialSolTransferState, submitted: state.submitted, notice: { tone: 'error', message: action.message, explorerUrl: null, signature: null } }
    case 'dismiss':
      return state.notice ? { ...state, notice: null } : state
  }
}
