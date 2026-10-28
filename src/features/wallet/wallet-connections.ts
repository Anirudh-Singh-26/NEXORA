import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { useTronWallet } from '@/features/tron/tron-provider'
import { useWallet } from '@/features/wallet-provider'
import { CHECKING_SUMMARY, nextStoredSummary, type ChainConnectionSummary } from '@/lib/wallet/connection-summary'

/**
 * What the page-level overview needs to know about a wallet connection that is owned by a provider living deeper in
 * the tree. EVM/Solana (Reown) and TRON are read straight from their app-wide providers; TON Connect is mounted lazily
 * inside the TON section, so that section REPORTS this summary upward. It carries no connection logic of its own:
 * `connect` / `disconnect` are the existing TON provider callbacks.
 */
export type { ConnectionPhase, ChainConnectionSummary } from '@/lib/wallet/connection-summary'
export { CHECKING_SUMMARY } from '@/lib/wallet/connection-summary'

/**
 * In-memory (per tab, never persisted or shared) copy of the TON summary. The TON section is mounted lazily on /wallet and
 * reports upward; keeping the latest report here lets the app-level active-wallet coordinator see TON as well.
 */
export const useTonSummaryStore = create<{ summary: ChainConnectionSummary; report: SummaryReporter }>((set, get) => ({
  summary: CHECKING_SUMMARY,
  // An identical report (same fields, same callback identities) leaves the store untouched, so no subscriber re-renders.
  report: (reported) => {
    const current = get().summary
    const next = nextStoredSummary(current, reported)
    if (next !== current) set({ summary: next })
  },
}))

export type SummaryReporter = (summary: ChainConnectionSummary | null) => void

/** Reports a summary upward for as long as the calling component is mounted; `null` is sent on unmount. */
export function useReportConnection(report: SummaryReporter | undefined, summary: ChainConnectionSummary) {
  useEffect(() => {
    report?.(summary)
  }, [report, summary])
  useEffect(() => () => report?.(null), [report])
}

/** Stable identity for a summary built from primitives and stable callbacks. */
export function useSummary(summary: ChainConnectionSummary): ChainConnectionSummary {
  const { phase, walletName, address, networkLabel, networkSupported, chain, networkKind, connect, disconnect, disconnecting } = summary
  return useMemo(
    () => ({ phase, walletName, address, networkLabel, networkSupported, chain, networkKind, connect, disconnect, disconnecting }),
    [phase, walletName, address, networkLabel, networkSupported, chain, networkKind, connect, disconnect, disconnecting],
  )
}

export interface ConnectionCounts { connected: number; total: number; checking: boolean }

/** One read of the four independent ecosystem connection states (no new connection logic). */
export function useConnectionCounts(ton: ChainConnectionSummary): ConnectionCounts {
  const wallet = useWallet()
  const tron = useTronWallet()
  return useMemo(() => {
    const flags = [
      wallet.evmAddress !== null,
      wallet.solanaAddress !== null,
      ton.phase === 'connected',
      tron.status === 'connected' && tron.address !== null,
    ]
    return { connected: flags.filter(Boolean).length, total: flags.length, checking: ton.phase === 'checking' }
  }, [wallet.evmAddress, wallet.solanaAddress, tron.status, tron.address, ton.phase])
}
