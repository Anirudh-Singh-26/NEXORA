/**
 * Pure state machine behind the activity hooks. Every action carries the key (ecosystem + chain + address) of the
 * request that produced it, and the reducer ignores any result whose key is not the one currently loaded, so a slow
 * response for a previous account or network can never overwrite the current account's rows.
 */
export interface FeedError { kind: string; message: string; retryable: boolean }

export interface FeedState<T extends { id: string }> {
  /** The key every field below belongs to. null = nothing loaded (no wallet / unsupported target). */
  key: string | null
  items: T[]
  nextCursor: string | null
  loading: boolean
  loadingMore: boolean
  loaded: boolean
  error: FeedError | null
  /** Set when "Load more" failed: the rows already loaded stay visible and only the extra page is flagged. */
  moreError: FeedError | null
}

export type FeedAction<T extends { id: string }> =
  | { type: 'reset' }
  | { type: 'begin'; key: string }
  | { type: 'loaded'; key: string; items: T[]; nextCursor: string | null }
  | { type: 'failed'; key: string; error: FeedError }
  | { type: 'more-begin'; key: string }
  | { type: 'more-loaded'; key: string; items: T[]; nextCursor: string | null }
  | { type: 'more-failed'; key: string; error: FeedError }

export function emptyFeed<T extends { id: string }>(): FeedState<T> {
  return { key: null, items: [], nextCursor: null, loading: false, loadingMore: false, loaded: false, error: null, moreError: null }
}

export function feedReducer<T extends { id: string }>(state: FeedState<T>, action: FeedAction<T>): FeedState<T> {
  if (action.type === 'reset') return emptyFeed<T>()
  if (action.type === 'begin') {
    // Keep rows only for a refresh of the SAME account + chain; a different key starts from nothing.
    return state.key === action.key
      ? { ...state, loading: true, loadingMore: false, error: null, moreError: null }
      : { ...emptyFeed<T>(), key: action.key, loading: true }
  }
  if (state.key !== action.key) return state // stale result for a previous account/network: ignore
  switch (action.type) {
    case 'loaded':
      return { ...emptyFeed<T>(), key: action.key, items: action.items, nextCursor: action.nextCursor, loaded: true }
    case 'failed':
      return { ...state, loading: false, loadingMore: false, error: action.error }
    case 'more-begin':
      return { ...state, loadingMore: true, moreError: null }
    case 'more-loaded': {
      const known = new Set(state.items.map((item) => item.id))
      return { ...state, items: [...state.items, ...action.items.filter((item) => !known.has(item.id))], nextCursor: action.nextCursor, loadingMore: false, moreError: null }
    }
    case 'more-failed':
      return { ...state, loadingMore: false, moreError: action.error }
  }
}
