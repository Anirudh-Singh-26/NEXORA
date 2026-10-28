/**
 * Pure rule for "one active wallet across EVM, Solana, TON and TRON" (no React, no wallet libraries, unit-tested).
 *
 * The rule is applied AFTER authorization, never before: a new wallet connects through its own provider while the
 * previous one stays untouched, so a rejected or failed request cannot lose the previous connection. Only when an
 * ecosystem is observed to have become connected does this plan say which other ecosystems must be disconnected.
 *
 * State is per browser tab/profile (React refs); nothing here is shared or persisted.
 */
export type WalletEcoId = 'evm' | 'solana' | 'ton' | 'tron'
/** 'restoring' = the provider is silently re-establishing a stored session (not a user-initiated connect). */
export type ObservedStatus = 'disconnected' | 'restoring' | 'connected'
export type ObservedStatuses = Record<WalletEcoId, ObservedStatus>

export interface ActiveWalletState {
  active: WalletEcoId | null
  statuses: ObservedStatuses
}

const ORDER: readonly WalletEcoId[] = ['evm', 'solana', 'ton', 'tron']

/** First observation: anything already connected on mount is a restored session, never a new authorization. */
export const INITIAL_ACTIVE_WALLET_STATE: ActiveWalletState = {
  active: null,
  statuses: { evm: 'restoring', solana: 'restoring', ton: 'restoring', tron: 'restoring' },
}

export interface ActiveWalletPlan {
  state: ActiveWalletState
  /** Ecosystems that must be disconnected now. Empty when the one-active invariant already holds. */
  disconnect: WalletEcoId[]
}

/**
 * - A freshly authorized ecosystem (disconnected -> connected) always becomes the active one.
 * - A restored session never displaces the active wallet; if another wallet is active the restored one is the stale one.
 * - With nothing active and several restored, the first in a fixed order is kept.
 * - Calling this again with the same statuses is harmless: it keeps naming the same losers until they are gone.
 */
export function planActiveWallet(prev: ActiveWalletState, next: ObservedStatuses): ActiveWalletPlan {
  const connected = ORDER.filter((id) => next[id] === 'connected')
  const fresh = connected.filter((id) => prev.statuses[id] === 'disconnected')
  const stillActive = prev.active !== null && connected.includes(prev.active) ? prev.active : null
  const winner = fresh.length > 0 ? fresh[fresh.length - 1] : stillActive ?? connected[0] ?? null
  return {
    state: { active: winner, statuses: next },
    disconnect: connected.filter((id) => id !== winner),
  }
}
