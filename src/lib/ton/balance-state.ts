import type { TonBalance } from './balance.ts'

/**
 * Pure state machine behind the balance hook. Every result carries the key (network + address) and request
 * number it was started with; a result that no longer matches the current key/request is ignored, so a late
 * response for a previous account, network or refresh can never be displayed.
 */

export type TonBalanceView =
  | { status: 'idle' }
  | { status: 'loading'; previous: TonBalance | null }
  | { status: 'ready'; balance: TonBalance }
  | { status: 'error'; message: string; previous: TonBalance | null }

export interface TonBalanceState {
  key: string | null
  requestId: number
  view: TonBalanceView
}

export type TonBalanceAction =
  | { type: 'start'; key: string; requestId: number }
  | { type: 'success'; key: string; requestId: number; balance: TonBalance }
  | { type: 'failure'; key: string; requestId: number; message: string }
  | { type: 'reset' }

export const initialTonBalanceState: TonBalanceState = { key: null, requestId: 0, view: { status: 'idle' } }

export function tonBalanceKey(address: string): string {
  return `testnet:${address}`
}

function lastKnown(view: TonBalanceView): TonBalance | null {
  if (view.status === 'ready') return view.balance
  if (view.status === 'loading' || view.status === 'error') return view.previous
  return null
}

export function tonBalanceReducer(state: TonBalanceState, action: TonBalanceAction): TonBalanceState {
  switch (action.type) {
    case 'reset':
      return initialTonBalanceState
    case 'start':
      // Another account/network never inherits the previous balance; the same one keeps it as "last successful read".
      return { key: action.key, requestId: action.requestId, view: { status: 'loading', previous: state.key === action.key ? lastKnown(state.view) : null } }
    case 'success':
      if (action.key !== state.key || action.requestId !== state.requestId) return state
      return { ...state, view: { status: 'ready', balance: action.balance } }
    case 'failure':
      if (action.key !== state.key || action.requestId !== state.requestId) return state
      return { ...state, view: { status: 'error', message: action.message, previous: lastKnown(state.view) } }
  }
}

/** What to render for the active key; a slot belonging to a different key is shown as a fresh load, never as its data. */
export function selectTonBalanceView(state: TonBalanceState, activeKey: string | null): TonBalanceView {
  if (activeKey === null) return { status: 'idle' }
  if (state.key !== activeKey) return { status: 'loading', previous: null }
  return state.view
}
