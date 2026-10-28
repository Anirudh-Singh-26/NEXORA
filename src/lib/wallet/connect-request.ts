/**
 * Pure helpers for the wallet connect flow (kept free of React/AppKit so they can be unit-tested).
 *
 * NEXORA's "connecting" state belongs to ONE request at a time. wagmi/AppKit keep reporting 'connecting' when a wallet
 * prompt is dismissed, so pending state is tracked here instead, keyed by a request id: a late result from an older
 * request (or one that was already closed) can never clear, or fail, a newer request.
 */
export interface ConnectRequestState { current: number | null }

export const IDLE_CONNECT_REQUEST: ConnectRequestState = { current: null }

export type ConnectRequestAction =
  | { type: 'begin'; id: number }
  | { type: 'settle'; id: number }
  | { type: 'close' }

export function connectRequestReducer(state: ConnectRequestState, action: ConnectRequestAction): ConnectRequestState {
  switch (action.type) {
    case 'begin': return { current: action.id }
    case 'settle': return state.current === action.id ? IDLE_CONNECT_REQUEST : state
    case 'close': return state.current === null ? state : IDLE_CONNECT_REQUEST
  }
}

export type ConnectErrorKind = 'rejected' | 'configuration' | 'unavailable' | 'other'
export interface ConnectErrorInfo { kind: ConnectErrorKind; message: string }

function messageOf(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const { message, code } = error as { message?: unknown; code?: unknown }
    return `${typeof code === 'number' || typeof code === 'string' ? `${code} ` : ''}${typeof message === 'string' ? message : ''}`.trim()
  }
  return ''
}

/** Sorts a wallet/AppKit connection error into an actionable category, only from what the error itself says. */
export function classifyConnectError(error: unknown): ConnectErrorInfo {
  const text = messageOf(error)
  if (/\b4001\b|user (rejected|denied|declined|cancel)|rejected|declined|denied|cancell?ed|closed the (modal|window|prompt)/i.test(text)) {
    return { kind: 'rejected', message: 'The connection request was cancelled in the wallet. Nothing was connected; you can try again.' }
  }
  if (/project ?id|origin not allowed|not allowed|allowlist|unauthori[sz]ed|\b(401|403)\b|invalid app ?id/i.test(text)) {
    return { kind: 'configuration', message: 'The wallet service rejected this app’s configuration (check the Reown project ID and its allowed domains).' }
  }
  if (/not (installed|detected|found)|no (wallet|provider|injected)|provider (is )?(unavailable|not found)|extension/i.test(text)) {
    return { kind: 'unavailable', message: 'The wallet extension is not available in this browser. Install or enable it for this site, then reload and try again.' }
  }
  return { kind: 'other', message: text ? `The wallet connection failed: ${text.slice(0, 160)}` : 'The wallet connection failed. Please try again.' }
}
