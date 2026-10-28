import { useCallback, useEffect, useRef, useState } from 'react'
import { CollectionDetailError, collectionDetailErrorMessage, fetchLiveCollection, type CollectionDetailErrorKind, type LiveCollectionDetailSnapshot } from '@/lib/nft-data/collection-detail'

export interface LiveCollectionState {
  status: 'loading' | 'ready' | 'error' | 'not-found'
  snapshot: LiveCollectionDetailSnapshot | null
  /** Set on failure; with status 'ready' it means a refresh failed and older data is shown. */
  error: string | null
  refreshing: boolean
  retry: () => void
}

/**
 * Loads one live collection by slug (works on direct URL / refresh because it needs only the slug).
 * Only the newest request may write state; changing slug resets to loading.
 */
export function useLiveCollection(slug: string): LiveCollectionState {
  const [data, setData] = useState<{ slug: string; snapshot: LiveCollectionDetailSnapshot | null; kind: CollectionDetailErrorKind | null; settled: boolean }>({ slug, snapshot: null, kind: null, settled: false })
  const [refreshing, setRefreshing] = useState(true)
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback((force: boolean) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    fetchLiveCollection(slug, { signal: controller.signal, forceRefresh: force })
      .then((snapshot) => { if (controllerRef.current === controller) setData({ slug, snapshot, kind: null, settled: true }) })
      .catch((e: unknown) => {
        if (controllerRef.current !== controller) return
        const kind = e instanceof CollectionDetailError ? e.kind : 'network'
        if (kind === 'aborted') return
        setData((prev) => ({ slug, snapshot: prev.slug === slug ? prev.snapshot : null, kind, settled: true }))
      })
      .finally(() => { if (controllerRef.current === controller) setRefreshing(false) })
  }, [slug])

  useEffect(() => {
    load(false)
    return () => controllerRef.current?.abort()
  }, [load])

  const retry = useCallback(() => {
    setRefreshing(true)
    load(true)
  }, [load])
  const current = data.slug === slug ? data : { slug, snapshot: null, kind: null, settled: false }
  const error = current.kind ? collectionDetailErrorMessage(current.kind) : null
  const status = current.kind === 'not-found' || current.kind === 'invalid-slug' ? 'not-found'
    : current.snapshot ? 'ready' : current.kind ? 'error' : 'loading'
  return { status, snapshot: current.snapshot, error, refreshing: data.slug !== slug || refreshing, retry }
}
