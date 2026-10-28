import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { blockchain, resolveBalanceTarget, type BalanceTarget, type ChainResult, type NativeBalance } from '@/lib/blockchain'

interface State {
  /** Which account/chain this result belongs to, so a stale result is never shown for another wallet state. */
  key: string | null
  result: ChainResult<NativeBalance> | null
  loading: boolean
}

/**
 * Read-only native balance for the connected account on its current chain, via the shared blockchain data layer
 * (public JSON-RPC, failover, cache). Fetches when account or chain changes and on refresh(); never polls.
 * In-flight requests are aborted on change/unmount and results from a previous account/chain are never returned.
 */
export function useNativeBalance(address: string | null, chainId: number | null) {
  const target: BalanceTarget = useMemo(() => resolveBalanceTarget(address, chainId, blockchain.listChains()), [address, chainId])
  const key = target.kind === 'ready' ? `${target.chainId}:${target.address}` : null
  const [state, setState] = useState<State>({ key: null, result: null, loading: false })
  const [nonce, setNonce] = useState(0)
  const forceRef = useRef(false)

  useEffect(() => {
    if (!key) {
      setState({ key: null, result: null, loading: false })
      return
    }
    const [chain, account] = key.split(':')
    const controller = new AbortController()
    const forceRefresh = forceRef.current
    forceRef.current = false
    setState((previous) => ({ key, result: previous.key === key ? previous.result : null, loading: true }))
    void blockchain.getNativeBalance(Number(chain), account, { signal: controller.signal, forceRefresh }).then((result) => {
      if (controller.signal.aborted) return
      setState({ key, result, loading: false })
    })
    return () => controller.abort()
  }, [key, nonce])

  const refresh = useCallback(() => {
    forceRef.current = true
    setNonce((value) => value + 1)
  }, [])

  const current = state.key === key
  return {
    target,
    result: current ? state.result : null,
    loading: key !== null && (!current || state.loading),
    refresh,
  }
}
