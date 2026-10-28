import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchWalletNfts, mergeNftPages, resolveNftTarget, type NftTarget, type WalletNft, type WalletNftsErrorKind } from '@/lib/wallet-nfts/wallet-nfts'

export interface NftsError { kind: WalletNftsErrorKind; message: string; retryable: boolean }

interface State {
  /** The `chainId:address` every field below belongs to. A mismatch with the current key means "stale: ignore". */
  key: string | null
  nfts: WalletNft[]
  nextPageKey: string | null
  totalCount: number | null
  hiddenSpam: number
  loading: boolean
  loadingMore: boolean
  loaded: boolean
  error: NftsError | null
  moreError: NftsError | null
}

const EMPTY: State = { key: null, nfts: [], nextPageKey: null, totalCount: null, hiddenSpam: 0, loading: false, loadingMore: false, loaded: false, error: null, moreError: null }

/**
 * Read-only NFTs owned by the connected EVM account on its current chain (via /api/wallet-nfts).
 * Loads when the account or chain changes and on refresh(); never polls. With no wallet, or an unsupported chain, no
 * request is made. Requests for a previous account/chain are aborted and their results ignored, and nothing from a
 * previous key is ever returned for the current one.
 */
export function useWalletNfts(address: string | null, chainId: number | null) {
  const target: NftTarget = useMemo(() => resolveNftTarget(address, chainId), [address, chainId])
  const key = target.kind === 'ready' ? `${target.chainId}:${target.address}` : null
  const [state, setState] = useState<State>(EMPTY)
  const [nonce, setNonce] = useState(0)
  const keyRef = useRef<string | null>(key)
  const stateRef = useRef<State>(state)
  const moreController = useRef<AbortController | null>(null)
  useEffect(() => { keyRef.current = key; stateRef.current = state })

  useEffect(() => {
    moreController.current?.abort()
     if (!key) return;
    const [chain, account] = key.split(':')
    const controller = new AbortController()
    // Keep the old rows only for a refresh of the SAME account+chain; a different key starts from nothing.
    setState((previous) => (previous.key === key ? { ...previous, loading: true, loadingMore: false, error: null, moreError: null } : { ...EMPTY, key, loading: true }))
    void fetchWalletNfts(Number(chain), account, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return
      if (result.status === 'ok') {
        setState({ ...EMPTY, key, nfts: result.page.nfts, nextPageKey: result.page.nextPageKey, totalCount: result.page.totalCount, hiddenSpam: result.page.hiddenSpam, loaded: true })
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
    void fetchWalletNfts(Number(chain), account, { pageKey: current.nextPageKey, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted || keyRef.current !== requestKey) return
      setState((previous) => {
        if (previous.key !== requestKey) return previous
        if (result.status !== 'ok') return { ...previous, loadingMore: false, moreError: { kind: result.kind, message: result.message, retryable: result.retryable } }
        return { ...previous, nfts: mergeNftPages(previous.nfts, result.page.nfts), nextPageKey: result.page.nextPageKey, totalCount: result.page.totalCount ?? previous.totalCount, hiddenSpam: previous.hiddenSpam + result.page.hiddenSpam, loadingMore: false }
      })
    })
  }, [])

  const current = key !== null && state.key === key
  const view = current ? state : { ...EMPTY, loading: key !== null }
  return { target, ...view, loading: key !== null && (!current || state.loading), refresh, loadMore }
}
