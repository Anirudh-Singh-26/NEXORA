/**
 * Pure (no React, no store) helpers for the TON connection summary that the TON section reports to the page-level store.
 * Kept separate so the "identical summary => no update" rule is unit-tested.
 */
export type ConnectionPhase = 'checking' | 'disconnected' | 'connecting' | 'connected' | 'setup' | 'unavailable'

export interface ChainConnectionSummary {
  phase: ConnectionPhase
  walletName: string | null
  /** Public address as shown to the user (already friendly-formatted), only while connected. */
  address: string | null
  networkLabel: string | null
  /** True only when the wallet positively reported the one network NEXORA supports for this chain. */
  networkSupported: boolean | null
  chain?: string | null
  networkKind?: 'testnet' | 'mainnet' | 'unknown' | null
  connect: (() => void) | null
  disconnect: (() => void) | null
  disconnecting: boolean
}

export const CHECKING_SUMMARY: ChainConnectionSummary = {
  phase: 'checking', walletName: null, address: null, networkLabel: null, networkSupported: null, chain: null, networkKind: null, connect: null, disconnect: null, disconnecting: false,
}

/** Field-by-field equality. `connect` / `disconnect` are compared by identity, so callers must pass stable callbacks. */
export function sameSummary(a: ChainConnectionSummary, b: ChainConnectionSummary): boolean {
  return a.phase === b.phase
    && a.walletName === b.walletName
    && a.address === b.address
    && a.networkLabel === b.networkLabel
    && a.networkSupported === b.networkSupported
    && a.chain === b.chain
    && a.networkKind === b.networkKind
    && a.connect === b.connect
    && a.disconnect === b.disconnect
    && a.disconnecting === b.disconnecting
}

/** The summary the store should hold after a report: the SAME object when nothing changed, so no subscriber is notified. */
export function nextStoredSummary(current: ChainConnectionSummary, reported: ChainConnectionSummary | null): ChainConnectionSummary {
  const next = reported ?? CHECKING_SUMMARY
  return sameSummary(current, next) ? current : next
}
