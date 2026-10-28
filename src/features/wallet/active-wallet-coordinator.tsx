import { useEffect, useRef } from 'react'
import { useWallet } from '@/features/wallet-provider'
import { useTronWallet } from '@/features/tron/tron-provider'
import { useTonSummaryStore } from '@/features/wallet/wallet-connections'
import { INITIAL_ACTIVE_WALLET_STATE, planActiveWallet, type ActiveWalletState, type ObservedStatus, type WalletEcoId } from '@/lib/wallet/active-wallet'

/**
 * Enforces ONE active wallet across Ethereum, Solana, TON and TRON.
 *
 * It only reacts to a wallet that has ALREADY authorized (its own provider reports connected). The previous wallet is then
 * disconnected through that wallet's own provider. Because nothing is disconnected before the new wallet authorizes, a
 * rejected or failed connect leaves the previous connection untouched.
 *
 * All state lives in this tab's memory (refs). There is no server state, lock or shared storage, so two Chrome profiles
 * (or two tabs) remain completely independent.
 */
export function ActiveWalletCoordinator() {
  const wallet = useWallet()
  const tron = useTronWallet()
  const ton = useTonSummaryStore((state) => state.summary)

  const evm: ObservedStatus = wallet.evmAddress !== null ? 'connected' : wallet.isEvmRestoring ? 'restoring' : 'disconnected'
  const solana: ObservedStatus = wallet.solanaAddress !== null ? 'connected' : wallet.isSolanaRestoring ? 'restoring' : 'disconnected'
  // TON Connect reports 'checking' while it restores a stored session; 'connecting' is a user request, not a restore.
  const tonStatus: ObservedStatus = ton.phase === 'connected' && ton.address !== null ? 'connected' : ton.phase === 'checking' ? 'restoring' : 'disconnected'
  const tronStatus: ObservedStatus = tron.status === 'connected' && tron.address !== null ? 'connected' : 'disconnected'

  const state = useRef<ActiveWalletState>(INITIAL_ACTIVE_WALLET_STATE)
  const inFlight = useRef(new Set<WalletEcoId>())
  // Latest disconnect callbacks, read when a disconnect actually runs, so the effect below depends only on the four statuses.
  const disconnectors = useRef<Record<WalletEcoId, () => Promise<unknown> | void>>({
    evm: () => undefined, solana: () => undefined, ton: () => undefined, tron: () => undefined,
  })
  useEffect(() => {
    disconnectors.current = {
      evm: () => wallet.disconnect('evm'),
      solana: () => wallet.disconnect('solana'),
      ton: () => ton.disconnect?.(),
      tron: () => tron.disconnect(),
    }
  })

  useEffect(() => {
    const plan = planActiveWallet(state.current, { evm, solana, ton: tonStatus, tron: tronStatus })
    state.current = plan.state
    for (const id of plan.disconnect) {
      if (inFlight.current.has(id)) continue
      inFlight.current.add(id)
      // Each provider reports its own disconnect failure; a failure here must never throw into React.
      Promise.resolve()
        .then(() => disconnectors.current[id]())
        .catch(() => undefined)
        .finally(() => { inFlight.current.delete(id) })
    }
  }, [evm, solana, tonStatus, tronStatus])

  return null
}
