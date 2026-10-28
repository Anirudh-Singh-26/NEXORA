import { useCallback, useEffect, useRef, useState } from 'react'
import { CollectionDetailError, collectionDetailErrorMessage } from '@/lib/nft-data/collection-detail'
import { fetchActivityPage, type ActivityEvent, type ActivityType } from '@/lib/nft-data/collection-extras'

export interface CollectionActivityState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  events: ActivityEvent[]
  next: string | null
  fetchedAt: number | null
  error: string | null
  loadingMore: boolean
  loadMoreError: string | null
  loadMore: () => void
  retry: () => void
}

interface Data { key: string; events: ActivityEvent[]; next: string | null; fetchedAt: number | null; error: string | null; settled: boolean }
const messageFor = (e: unknown) => collectionDetailErrorMessage(e instanceof CollectionDetailError ? e.kind : 'network')
const isAbort = (e: unknown) => e instanceof CollectionDetailError && e.kind === 'aborted'

/**
 * Recent collection activity of one type. `enabled` lets the page fetch lazily (only once the Activity tab has been
 * opened), which keeps OpenSea rate-limit use down. Changing slug/type starts over.
 */
export function useCollectionActivity(slug: string, type: ActivityType, enabled: boolean): CollectionActivityState {
  const key = `${slug}|${type}`
  const [data, setData] = useState<Data>({ key, events: [], next: null, fetchedAt: null, error: null, settled: false })
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const moreRef = useRef<AbortController | null>(null)
  const nextRef = useRef<string | null>(null);

  useEffect(() => {
    nextRef.current = data.key === key ? data.next : null;
  }, [data, key]);

  const load = useCallback((force: boolean) => {
    controllerRef.current?.abort()
    moreRef.current?.abort()
    moreRef.current = null
    const controller = new AbortController()
    controllerRef.current = controller
    setLoadingMore(false)
    setLoadMoreError(null)
    fetchActivityPage(slug, type, { signal: controller.signal, forceRefresh: force })
      .then((page) => { if (controllerRef.current === controller) setData({ key, events: page.events, next: page.next, fetchedAt: page.fetchedAt, error: null, settled: true }) })
      .catch((e: unknown) => {
        if (controllerRef.current !== controller || isAbort(e)) return
        setData((prev) => ({ key, events: prev.key === key ? prev.events : [], next: prev.key === key ? prev.next : null, fetchedAt: prev.key === key ? prev.fetchedAt : null, error: messageFor(e), settled: true }))
      })
  }, [slug, type, key])

  useEffect(() => {
    if (!enabled) return
    load(false)
    return () => { controllerRef.current?.abort(); moreRef.current?.abort(); moreRef.current = null }
  }, [enabled, load])

  const loadMore = useCallback(() => {
    const cursor = nextRef.current
    if (!cursor || moreRef.current) return
    const controller = new AbortController()
    moreRef.current = controller
    const owner = controllerRef.current
    setLoadingMore(true)
    setLoadMoreError(null)
    fetchActivityPage(slug, type, { signal: controller.signal, next: cursor })
      .then((page) => {
        if (controllerRef.current !== owner || moreRef.current !== controller) return
        setData((prev) => {
          const seen = new Set(prev.events.map((e) => e.id))
          return { ...prev, events: [...prev.events, ...page.events.filter((e) => !seen.has(e.id))], next: page.next }
        })
      })
      .catch((e: unknown) => {
        if (controllerRef.current !== owner || moreRef.current !== controller || isAbort(e)) return
        setLoadMoreError(messageFor(e))
      })
      .finally(() => { if (moreRef.current === controller) { moreRef.current = null; setLoadingMore(false) } })
  }, [slug, type])

  const current = data.key === key ? data : { key, events: [], next: null, fetchedAt: null, error: null, settled: false }
  const status = !enabled && !current.settled ? 'idle' : current.events.length || (current.settled && !current.error) ? 'ready' : current.error ? 'error' : 'loading'
  return {
    status, events: current.events, next: current.next, fetchedAt: current.fetchedAt,
    error: status === 'error' ? current.error : null, loadingMore, loadMoreError, loadMore, retry: () => load(true),
  }
}
