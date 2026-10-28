import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { catalog } from '@/data/catalog'
import type { Token } from '@/data/types'
import { applyQuotes, fetchMarketSnapshot, MarketDataError, marketErrorMessage, type MarketSnapshot } from '@/lib/market-data/coingecko'

export interface LiveTokensState {
  status: 'loading' | 'ready' | 'error'
  /** Tokens with complete live quotes. Empty until the first successful load. */
  tokens: Token[]
  /** Catalogue tokens without a live quote (fictional or omitted by the provider). */
  excluded: Token[]
  snapshot: MarketSnapshot | null
  /** Set on failure; with status 'ready' it means a refresh failed and the data shown is older. */
  error: string | null
  refreshing: boolean
  /** Re-fetch now (bypasses the 60s cache). */
  retry: () => void
}

/** Loads live market data once on mount. No polling: the keyless API is rate limited, so refresh is user-initiated. */
export function useLiveTokens(): LiveTokensState {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(true)
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback((force: boolean) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setRefreshing(true)
    fetchMarketSnapshot({ signal: controller.signal, forceRefresh: force })
      .then((snap) => { setSnapshot(snap); setError(null) })
      .catch((e: unknown) => {
        const kind = e instanceof MarketDataError ? e.kind : 'network'
        if (kind === 'aborted') return
        setError(marketErrorMessage(kind))
      })
      .finally(() => { if (controllerRef.current === controller) setRefreshing(false) })
  }, [])

  useEffect(() => {
    load(false)
    return () => controllerRef.current?.abort()
  }, [load])

  const retry = useCallback(() => load(true), [load])

  const { tokens, excluded } = useMemo(() => {
    if (!snapshot) return { tokens: [] as Token[], excluded: [] as Token[] }
    const { live, excluded: ex } = applyQuotes(catalog.tokens, snapshot)
    return { tokens: live, excluded: ex }
  }, [snapshot])

  const status = snapshot ? 'ready' : error ? 'error' : 'loading'
  return { status, tokens, excluded, snapshot, error, refreshing, retry }
}
