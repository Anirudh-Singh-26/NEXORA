import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { fetchTonTestnetBalance, TonBalanceError } from '@/lib/ton/balance'
import { initialTonBalanceState, selectTonBalanceView, tonBalanceKey, tonBalanceReducer, type TonBalanceView } from '@/lib/ton/balance-state'
import type { TonBalanceGate } from '@/lib/ton/chain'

/**
 * Read-only native TON balance on TESTNET. A request is made ONLY while `gate.allowed` is true, i.e. the wallet
 * positively reported TON testnet (see evaluateTonBalanceGate). Mainnet, unknown networks, restoring sessions and
 * disconnected wallets never reach the network. Results are keyed by network + address and by request number, so a
 * late response for a previous account or an older refresh is discarded (see balance-state.ts).
 */
export function useTonTestnetBalance(gate: TonBalanceGate, apiBase: string): { view: TonBalanceView; refresh: () => void } {
  const [state, dispatch] = useReducer(tonBalanceReducer, initialTonBalanceState)
  const [nonce, setNonce] = useState(0)
  const counter = useRef(0)
  const address = gate.allowed ? gate.address : null

  useEffect(() => {
    if (address === null) {
      dispatch({ type: 'reset' })
      return
    }
    const key = tonBalanceKey(address)
    const requestId = ++counter.current
    const controller = new AbortController()
    dispatch({ type: 'start', key, requestId })
    fetchTonTestnetBalance(address, { base: apiBase, signal: controller.signal }).then(
      (balance) => { if (!controller.signal.aborted) dispatch({ type: 'success', key, requestId, balance }) },
      (error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof TonBalanceError ? error.message : 'The balance could not be read.'
        dispatch({ type: 'failure', key, requestId, message })
      },
    )
    return () => controller.abort()
  }, [address, apiBase, nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  return { view: selectTonBalanceView(state, address === null ? null : tonBalanceKey(address)), refresh }
}
