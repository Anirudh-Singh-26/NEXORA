import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchSolanaBalance, resolveSolanaTarget, type SolanaBalance, type SolanaBalanceErrorKind, type SolanaBalanceTarget } from '@/lib/solana-balance/solana-balance'

export interface SolanaBalanceError { kind: SolanaBalanceErrorKind; message: string; retryable: boolean }

interface State {
  /** Identifies the request this result answers (`network:address#nonce`). A mismatch with the current ticket means "not settled yet". */
  ticket: string | null
  /** The network:address every field below belongs to. A mismatch with the current key means "stale: ignore". */
  key: string | null
  balance: SolanaBalance | null
  error: SolanaBalanceError | null
}

const EMPTY: State = { ticket: null, key: null, balance: null, error: null }

/**
 * Read-only native SOL balance for the connected Solana account (via /api/solana-balance). Loads when the address
 * or network changes and on refresh(); never polls. Requests for a previous address or network are aborted and their
 * results ignored — nothing from a previous address or network is ever returned for the current combination.
 *
 * `loading` is DERIVED (a request exists for the current ticket and its result has not arrived), never stored, so a result
 * that arrives immediately can never be overwritten by a late "loading" update and every outcome (balance, zero, error,
 * timeout) ends it.
 *
 * `networkName` should be the name AppKit reports for the active Solana network (e.g. \"Solana Devnet\").
 * Pass null when the wallet is connected but hasn't reported its network; omit when no network info is available.
 */
export function useSolanaBalance(address: string | null, networkName?: string | null) {
  const target: SolanaBalanceTarget = useMemo(() => resolveSolanaTarget(address, networkName), [address, networkName])
  // Key includes both network and address: a response from a different network or account is always rejected.
  const key = target.kind === 'ready' ? `${target.networkName}:${target.address}` : null
  // The request itself takes the bare address; the key is only an identity for state (it is not a valid Solana address).
  const readyAddress = target.kind === 'ready' ? target.address : null
  const [state, setState] = useState<State>(EMPTY)
  const [nonce, setNonce] = useState(0)
  const ticket = key === null ? null : `${key}#${nonce}`

  useEffect(() => {
    if (!key || !readyAddress || !ticket) return
    const controller = new AbortController()
    void fetchSolanaBalance(readyAddress, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return
      if (result.status === 'ok') setState({ ticket, key, balance: result.balance, error: null })
      // Keep the old value only for a refresh of the SAME address and network; a different one starts from nothing.
      else setState((previous) => ({ ticket, key, balance: previous.key === key ? previous.balance : null, error: { kind: result.kind, message: result.message, retryable: result.retryable } }))
    })
    return () => controller.abort()
  }, [key, readyAddress, ticket])

  const refresh = useCallback(() => setNonce((value) => value + 1), [])

  const current = state.key === key
  const settled = ticket !== null && state.ticket === ticket
  return {
    target,
    balance: current ? state.balance : null,
    error: settled ? state.error : null,
    loading: ticket !== null && !settled,
    refresh,
  }
}
