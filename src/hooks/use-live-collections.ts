import { useCallback, useEffect, useRef, useState } from 'react'
import { CollectionsError, collectionsErrorMessage, fetchLiveCollections } from '@/lib/nft-data/collections'
import type { LiveCollectionsSnapshot } from '@/lib/nft-data/types'

export interface LiveCollectionsState {
  status: 'loading' | 'ready' | 'error'
  snapshot: LiveCollectionsSnapshot | null
  /** Set on failure; with status 'ready' it means a refresh failed and older data is shown. */
  error: string | null
  refreshing: boolean
  /** Re-fetch now (bypasses the client cache; the proxy still applies its own cache). */
  retry: () => void
}

/**
 * Loads live collections once on mount; no polling. Only the newest request may write state, so a slow
 * obsolete response can never overwrite a newer one, and unmounting just stops waiting.
 */
export function useLiveCollections(): LiveCollectionsState {
  const [snapshot, setSnapshot] = useState<LiveCollectionsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(true)
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback((force: boolean, initial = false) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    if (!initial) setRefreshing(true) // initial state is already `refreshing`
    fetchLiveCollections({ signal: controller.signal, forceRefresh: force })
      .then((snap) => { if (controllerRef.current === controller) { setSnapshot(snap); setError(null) } })
      .catch((e: unknown) => {
        if (controllerRef.current !== controller) return // obsolete: a newer request owns the state
        setError(collectionsErrorMessage(e instanceof CollectionsError ? e.kind : 'network'))
      })
      .finally(() => { if (controllerRef.current === controller) setRefreshing(false) })
  }, [])

  useEffect(() => {
    load(false, true)
    return () => controllerRef.current?.abort()
  }, [load])

  const retry = useCallback(() => load(true), [load])
  return { status: snapshot ? 'ready' : error ? 'error' : 'loading', snapshot, error, refreshing, retry }
}
