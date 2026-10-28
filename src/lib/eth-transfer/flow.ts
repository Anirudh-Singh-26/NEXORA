/**
 * Pure state machine for the ETH send panel: editing → reviewing → sending (wallet) → confirming → editing with a notice.
 * No React, no I/O. A second 'send' while one is in flight is ignored, which is what prevents duplicate submissions; a
 * submitted transfer is never re-sent by any action here.
 */
import { sepoliaTxUrl } from '../network/testnet.ts'
import type { EthSubmitOutcome } from './submit.ts'

export interface EthTransferReview { recipient: `0x${string}`; wei: bigint; maxFeeWei: bigint }
export interface EthSubmitted { hash: `0x${string}`; recipient: `0x${string}`; wei: bigint; maxFeeWei: bigint }

export type EthTransferNotice = { tone: 'success' | 'info' | 'error'; message: string; explorerUrl: string | null; hash: string | null }
export type EthTransferPhase = 'editing' | 'reviewing' | 'sending' | 'confirming'
export type EthChainState = 'pending' | 'success' | 'reverted'

export interface EthTransferState {
  phase: EthTransferPhase
  review: EthTransferReview | null
  submitted: EthSubmitted | null
  notice: EthTransferNotice | null
}

export type EthTransferAction =
  | { type: 'review'; review: EthTransferReview }
  | { type: 'back' }
  | { type: 'send' }
  | { type: 'outcome'; outcome: EthSubmitOutcome }
  | { type: 'poll'; state: EthChainState }
  | { type: 'poll-timeout' }
  | { type: 'resume-confirming' }
  | { type: 'abort'; message: string }
  | { type: 'dismiss' }

export const initialEthTransferState: EthTransferState = { phase: 'editing', review: null, submitted: null, notice: null }

function noticeFor(submitted: EthSubmitted, state: EthChainState | 'timeout'): EthTransferNotice {
  const base = { explorerUrl: sepoliaTxUrl(submitted.hash), hash: submitted.hash }
  switch (state) {
    case 'success': return { tone: 'success', message: 'Your transfer is confirmed on Ethereum Sepolia (included in a block).', ...base }
    case 'reverted': return { tone: 'error', message: 'The transaction was included on Sepolia but reverted, so the ETH was not transferred (only the network fee was charged). Check the explorer for details.', ...base }
    case 'timeout': return { tone: 'info', message: 'Not confirmed yet. NEXORA stopped waiting after about two minutes, which does not mean it failed: it may still land. Check the explorer, or look it up again.', ...base }
    case 'pending': return { tone: 'info', message: 'Submitted to Sepolia; waiting for confirmation.', ...base }
  }
}

export function ethTransferReducer(state: EthTransferState, action: EthTransferAction): EthTransferState {
  switch (action.type) {
    case 'review':
      if (state.phase === 'sending' || state.phase === 'confirming') return state
      return { ...initialEthTransferState, phase: 'reviewing', review: action.review }
    case 'back':
      return state.phase === 'reviewing' ? { ...initialEthTransferState } : state
    case 'send':
      if (state.phase !== 'reviewing' || !state.review) return state // duplicate or out-of-order sends are ignored
      return { ...state, phase: 'sending', notice: null }
    case 'outcome': {
      if (state.phase !== 'sending' || !state.review) return state
      const { outcome } = action
      if (outcome.status === 'blocked') return { ...initialEthTransferState, notice: { tone: 'error', message: `${outcome.message} Nothing was sent.`, explorerUrl: null, hash: null } }
      if (outcome.status === 'failed') {
        const tone = outcome.failure.kind === 'user-rejected' ? 'info' : 'error'
        const extra = outcome.possiblySent ? ' Your wallet may already have broadcast this transaction, so check your wallet history or the explorer before trying again.' : ''
        return { ...initialEthTransferState, notice: { tone, message: `${outcome.failure.message}${extra}`, explorerUrl: null, hash: null } }
      }
      const submitted: EthSubmitted = { hash: outcome.hash, recipient: state.review.recipient, wei: state.review.wei, maxFeeWei: outcome.maxFeeWei }
      return { phase: 'confirming', review: null, submitted, notice: null }
    }
    case 'poll': {
      if (state.phase !== 'confirming' || !state.submitted) return state
      if (action.state === 'pending') return state
      return { ...initialEthTransferState, submitted: state.submitted, notice: noticeFor(state.submitted, action.state) }
    }
    case 'poll-timeout':
      if (state.phase !== 'confirming' || !state.submitted) return state
      return { ...initialEthTransferState, submitted: state.submitted, notice: noticeFor(state.submitted, 'timeout') }
    case 'resume-confirming':
      if (state.phase !== 'editing' || !state.submitted) return state
      return { ...state, phase: 'confirming', notice: null }
    case 'abort':
      if (state.phase === 'sending' || state.phase === 'confirming') return state
      return { ...initialEthTransferState, submitted: state.submitted, notice: { tone: 'error', message: action.message, explorerUrl: null, hash: null } }
    case 'dismiss':
      return state.notice ? { ...state, notice: null } : state
  }
}
