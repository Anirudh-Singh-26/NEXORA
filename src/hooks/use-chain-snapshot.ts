import { useCallback, useEffect, useRef, useState } from 'react'
import { blockchain, type ChainResult, type ChainSnapshot } from '@/lib/blockchain'

interface State {
  chainId: number | null
  result: ChainResult<ChainSnapshot> | null
  loading: boolean
}

/**
 * Reads a chain snapshot through the shared data layer. No wallet is needed and nothing polls:
 * it fetches when `chainId` changes and when `refresh()` is called. Results for a previous chain are never
 * returned for the current one, and in-flight requests are cancelled on chain change or unmount.
 */
export function useChainSnapshot(chainId: number | null) {
  const [state, setState] = useState<State>({ chainId: null, result: null, loading: false })
  const [nonce, setNonce] = useState(0)
  const forceRef = useRef(false)

  useEffect(() => {
    if (chainId === null) return;
    const controller = new AbortController();
    const forceRefresh = forceRef.current;
    forceRef.current = false;
    setState((previous) => ({
      chainId,
      result: previous.chainId === chainId ? previous.result : null,
      loading: true,
    }));
    void blockchain
      .getChainSnapshot(chainId, { signal: controller.signal, forceRefresh })
      .then((result) => {
        if (controller.signal.aborted) return;
        setState({ chainId, result, loading: false });
      });
    return () => controller.abort();
  }, [chainId, nonce]);

  const refresh = useCallback(() => {
    forceRef.current = true
    setNonce((value) => value + 1)
  }, [])

  const current = state.chainId === chainId
  return {
    result: current ? state.result : null,
    loading: chainId !== null && (!current || state.loading),
    refresh,
  }
}
