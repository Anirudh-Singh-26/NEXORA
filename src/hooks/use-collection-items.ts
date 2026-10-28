import { useCallback, useEffect, useRef, useState } from 'react'
import { CollectionDetailError, collectionDetailErrorMessage } from '@/lib/nft-data/collection-detail'
import { fetchItemsPage, type ItemsPage, type LiveItem } from '@/lib/nft-data/collection-extras'
import type { Amount } from '@/lib/nft-data/types'

export interface CollectionItemsState {
  status: 'loading' | 'ready' | 'error'
  items: LiveItem[]
  listings: Record<string, Amount>
  lastSales: Record<string, Amount>
  next: string | null
  unavailable: ItemsPage['unavailable']
  fetchedAt: number | null
  /** Set when the first page failed (status 'error'). */
  error: string | null
  loadingMore: boolean
  /** Set when "load more" failed; the items already loaded stay on screen. */
  loadMoreError: string | null
  refreshing: boolean
  loadMore: () => void
  retry: () => void
}

interface Core { slug: string; page: ItemsPage | null; items: LiveItem[]; error: string | null }
const messageFor = (e: unknown) => collectionDetailErrorMessage(e instanceof CollectionDetailError ? e.kind : 'network')
const isAbort = (e: unknown) => e instanceof CollectionDetailError && e.kind === 'aborted'

/**
 * First page of NFTs for a live collection, plus cursor pagination ("load more"). The first page also carries the
 * price lookups (cheapest listings / latest sales). Only the newest first-page request may write state.
 */
export function useCollectionItems(slug: string): CollectionItemsState {
  const [core, setCore] = useState<Core>({ slug, page: null, items: [], error: null })
  const [listings, setListings] = useState<Record<string, Amount>>({})
  const [lastSales, setLastSales] = useState<Record<string, Amount>>({})
  const [refreshing, setRefreshing] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const moreRef = useRef<AbortController | null>(null)
  const nextRef = useRef<string | null>(null)
  // Update ref after render
  useEffect(() => {
    nextRef.current = next
  }, [next])

  const load = useCallback((force: boolean) => {
    controllerRef.current?.abort()
    moreRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setRefreshing(true)
    setLoadingMore(false)
    setLoadMoreError(null)
    fetchItemsPage(slug, { signal: controller.signal, forceRefresh: force })
      .then((page) => {
        if (controllerRef.current !== controller) return
        setCore({ slug, page, items: page.items, error: null })
        setListings(page.listings)
        setLastSales(page.lastSales)
        setNext(page.next)
      })
      .catch((e: unknown) => {
        if (controllerRef.current !== controller || isAbort(e)) return
        setCore((prev) => ({ slug, page: prev.slug === slug ? prev.page : null, items: prev.slug === slug ? prev.items : [], error: messageFor(e) }))
      })
      .finally(() => { if (controllerRef.current === controller) setRefreshing(false) })
  }, [slug])

  useEffect(() => {
    // Defer load to avoid synchronous state update within effect
    setTimeout(() => load(false), 0)
    return () => { controllerRef.current?.abort(); moreRef.current?.abort() }
  }, [load])

  const loadMore = useCallback(() => {
    const cursor = nextRef.current
    if (!cursor || moreRef.current) return
    const controller = new AbortController()
    moreRef.current = controller
    const owner = controllerRef.current
    setLoadingMore(true)
    setLoadMoreError(null)
    fetchItemsPage(slug, { signal: controller.signal, next: cursor })
      .then((page) => {
        if (controllerRef.current !== owner || moreRef.current !== controller) return
        setCore((prev) => {
          const seen = new Set(prev.items.map((i) => i.identifier))
          return { ...prev, items: [...prev.items, ...page.items.filter((i) => !seen.has(i.identifier))] }
        })
        setNext(page.next)
      })
      .catch((e: unknown) => {
        if (controllerRef.current !== owner || moreRef.current !== controller || isAbort(e)) return
        setLoadMoreError(messageFor(e))
      })
      .finally(() => { if (moreRef.current === controller) { moreRef.current = null; setLoadingMore(false) } })
  }, [slug])

  const current = core.slug === slug ? core : { slug, page: null, items: [], error: null }
  const status = current.page || current.items.length ? 'ready' : current.error ? 'error' : 'loading'
  return {
    status, items: current.items, listings: current.page ? listings : {}, lastSales: current.page ? lastSales : {}, next: current.page ? next : null,
    unavailable: current.page?.unavailable ?? [], fetchedAt: current.page?.fetchedAt ?? null,
    error: status === 'error' ? current.error : null, loadingMore, loadMoreError, refreshing, loadMore, retry: () => load(true),
  }
}
