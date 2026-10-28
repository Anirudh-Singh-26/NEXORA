import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchWalletTokens, resolveTokenTarget, type TokenTarget, type WalletToken, type WalletTokensErrorKind } from '@/lib/wallet-tokens/wallet-tokens'

export interface TokensError { kind: WalletTokensErrorKind; message: string; retryable: boolean }

interface State {
  /** `${chainId}:${address}` that every field below belongs to. A mismatch with the current key means "stale: ignore". */
  key: string | null
  tokens: WalletToken[]
  nextPageKey: string | null
  metadataPartial: boolean
  loading: boolean
  loadingMore: boolean
  loaded: boolean
  error: TokensError | null
  /** Set when "Load more" failed: the first page stays visible and only the extra page is flagged. */
  moreError: TokensError | null
}

const EMPTY: State = { key: null, tokens: [], nextPageKey: null, metadataPartial: false, loading: false, loadingMore: false, loaded: false, error: null, moreError: null }

/**
 * Read-only ERC-20 balances for the connected account on its current chain (via /api/wallet-tokens).
 * Loads when the account or chain changes and on refresh(); never polls. Requests for a previous account/chain are
 * aborted and their results ignored, and nothing from a previous key is ever returned for the current one.
 */
export function useWalletTokens(address: string | null, chainId: number | null) {
  const target: TokenTarget = useMemo(() => resolveTokenTarget(address, chainId), [address, chainId])
  const key = target.kind === 'ready' ? `${target.chainId}:${target.address}` : null
  const [state, setState] = useState<State>(EMPTY)
  const [nonce, setNonce] = useState(0)
  const keyRef = useRef<string | null>(key)
  const stateRef = useRef<State>(state)
  const moreController = useRef<AbortController | null>(null)

  // Update refs after render to avoid accessing them during render
  useEffect(() => {
    keyRef.current = key
    stateRef.current = state
  }, [key, state])

  useEffect(() => {
    moreController.current?.abort()
    if (!key) {
      // Reset state when key is null
      setTimeout(() => setState(EMPTY), 0)
      return
    }
    const [chain, account] = key.split(':')
    const controller = new AbortController()
    // Keep the old rows only for a refresh of the SAME account+chain; a different key starts from nothing.
    setTimeout(() => {
      setState((previous) => (previous.key === key ? { ...previous, loading: true, loadingMore: false, error: null, moreError: null } : { ...EMPTY, key, loading: true }))
    }, 0)
    void fetchWalletTokens(Number(chain), account, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return
      if (result.status === 'ok') {
        setState({ ...EMPTY, key, tokens: result.page.tokens, nextPageKey: result.page.nextPageKey, metadataPartial: result.page.metadataPartial, loaded: true })
      } else {
        setState((previous) => ({ ...(previous.key === key ? previous : EMPTY), key, loading: false, error: { kind: result.kind, message: result.message, retryable: result.retryable } }))
      }
    })
    return () => { controller.abort(); moreController.current?.abort() }
  }, [key, nonce])

  const refresh = useCallback(() => setNonce((value) => value + 1), [])

  const loadMore = useCallback(() => {
    const current = stateRef.current
    const requestKey = keyRef.current
    if (!requestKey || current.key !== requestKey || !current.nextPageKey || current.loading || current.loadingMore) return
    const [chain, account] = requestKey.split(':')
    const controller = new AbortController()
    moreController.current = controller
    setState((previous) => (previous.key === requestKey ? { ...previous, loadingMore: true, moreError: null } : previous))
    void fetchWalletTokens(Number(chain), account, { pageKey: current.nextPageKey, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted || keyRef.current !== requestKey) return
      setState((previous) => {
        if (previous.key !== requestKey) return previous
        if (result.status !== 'ok') return { ...previous, loadingMore: false, moreError: { kind: result.kind, message: result.message, retryable: result.retryable } }
        const known = new Set(previous.tokens.map((token) => token.contract))
        const added = result.page.tokens.filter((token) => !known.has(token.contract))
        return { ...previous, tokens: [...previous.tokens, ...added], nextPageKey: result.page.nextPageKey, metadataPartial: previous.metadataPartial || result.page.metadataPartial, loadingMore: false }
      })
    })
  }, [])

  const current = key !== null && state.key === key
  const view = current ? state : { ...EMPTY, loading: key !== null }
  return { target, ...view, loading: key !== null && (!current || state.loading), refresh, loadMore }
}
