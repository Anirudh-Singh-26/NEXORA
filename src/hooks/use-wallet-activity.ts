import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { emptyFeed, feedReducer, type FeedError } from '@/lib/wallet-activity/feed-state'
import {
  fetchEvmActivity, fetchSolanaActivity, resolveActivityTarget,
  type ActivityTarget, type EvmEntry, type PageResult, type SolanaEntry, type TargetInput,
} from '@/lib/wallet-activity/wallet-activity'

export type ActivityError = FeedError
type Entry = EvmEntry | SolanaEntry

interface Base { target: ActivityTarget; refresh: () => void; loadMore: () => void }
export type WalletActivity =
  | (Base & { ecosystem: 'evm' } & FeedView<EvmEntry>)
  | (Base & { ecosystem: 'solana' } & FeedView<SolanaEntry>)
  | (Base & { ecosystem: null } & FeedView<never>)

interface FeedView<T extends { id: string }> {
  items: T[]
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
  loaded: boolean
  error: ActivityError | null
  moreError: ActivityError | null
}

/**
 * Read-only transaction history for the connected account (EVM via /api/wallet-activity, Solana via /api/solana-activity).
 * Requests only fire for a fully resolved target (connected, valid address, supported chain), so a disconnected or
 * unsupported wallet causes no network traffic. Loads when the account, ecosystem or chain changes and on refresh();
 * never polls. A previous target's request is aborted, and results are keyed so a late response can never be attached to
 * the current account (see feed-state.ts).
 */
export function useWalletActivity(input: TargetInput): WalletActivity {
  const { ecosystem, address, chainId, solanaNetworkName } = input
  const target = useMemo(() => resolveActivityTarget({ ecosystem, address, chainId, solanaNetworkName }), [ecosystem, address, chainId, solanaNetworkName])
  const key = target.kind === 'ready' ? target.key : null
  const [state, dispatch] = useReducer(feedReducer<Entry>, emptyFeed<Entry>())
  const [nonce, setNonce] = useState(0)
  const targetRef = useRef(target)
  const stateRef = useRef(state)
  const moreController = useRef<AbortController | null>(null)
  targetRef.current = target
  stateRef.current = state

  const fetchPage = useCallback((t: ActivityTarget, cursor: string | null, signal: AbortSignal): Promise<PageResult<Entry>> => {
    if (t.kind !== 'ready') return Promise.resolve({ status: 'error', kind: 'invalid-request', message: 'Not ready.', retryable: false })
    return t.ecosystem === 'evm' ? fetchEvmActivity(t.chainId, t.address, { cursor, signal }) : fetchSolanaActivity(t.address, { cursor, signal })
  }, [])

  useEffect(() => {
    moreController.current?.abort()
    if (!key) { dispatch({ type: 'reset' }); return }
    const controller = new AbortController()
    dispatch({ type: 'begin', key })
    void fetchPage(targetRef.current, null, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      if (result.status === 'ok') dispatch({ type: 'loaded', key, items: result.items, nextCursor: result.nextCursor })
      else dispatch({ type: 'failed', key, error: { kind: result.kind, message: result.message, retryable: result.retryable } })
    })
    return () => { controller.abort(); moreController.current?.abort() }
  }, [key, nonce, fetchPage])

  const refresh = useCallback(() => setNonce((value) => value + 1), [])

  const loadMore = useCallback(() => {
    const current = stateRef.current
    const requestTarget = targetRef.current
    if (requestTarget.kind !== 'ready' || current.key !== requestTarget.key || !current.nextCursor || current.loading || current.loadingMore) return
    const requestKey = requestTarget.key
    const controller = new AbortController()
    moreController.current = controller
    dispatch({ type: 'more-begin', key: requestKey })
    void fetchPage(requestTarget, current.nextCursor, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      if (result.status === 'ok') dispatch({ type: 'more-loaded', key: requestKey, items: result.items, nextCursor: result.nextCursor })
      else dispatch({ type: 'more-failed', key: requestKey, error: { kind: result.kind, message: result.message, retryable: result.retryable } })
    })
  }, [fetchPage])

  // Only ever expose rows that belong to the CURRENT key; anything else is treated as "nothing yet".
  const current = key !== null && state.key === key
  const view = current ? state : emptyFeed<Entry>()
  const common = {
    target, refresh, loadMore,
    hasMore: view.nextCursor !== null,
    loading: key !== null && (!current || state.loading),
    loadingMore: view.loadingMore, loaded: view.loaded, error: view.error, moreError: view.moreError,
  }
  if (target.kind === 'ready' && target.ecosystem === 'evm') return { ...common, ecosystem: 'evm', items: view.items as EvmEntry[] }
  if (target.kind === 'ready' && target.ecosystem === 'solana') return { ...common, ecosystem: 'solana', items: view.items as SolanaEntry[] }
  return { ...common, ecosystem: null, items: [] }
}
