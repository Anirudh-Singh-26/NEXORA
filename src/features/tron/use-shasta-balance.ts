import { useCallback, useEffect, useState } from 'react'
import { fetchShastaBalance, ShastaBalanceError, type ShastaBalance } from '@/lib/tron/balance'

export type ShastaBalanceView =
  | { status: 'idle' }
  | { status: 'loading'; previous: ShastaBalance | null }
  | { status: 'ready'; balance: ShastaBalance }
  | { status: 'error'; message: string; previous: ShastaBalance | null }

interface Slot { address: string; view: Exclude<ShastaBalanceView, { status: 'idle' }> }

/** The last successfully read balance for this same address, if any. */
function lastKnown(slot: Slot | null, address: string): ShastaBalance | null {
  if (!slot || slot.address !== address) return null
  return slot.view.status === 'ready' ? slot.view.balance : slot.view.previous
}

/**
 * Read-only native TRX balance from the fixed Shasta endpoint. `enabled` must be true ONLY when the wallet's
 * network was positively identified as Shasta; otherwise nothing is requested and nothing is shown.
 * Results are keyed by address so a late response for a previous account can never be displayed.
 */
export function useShastaBalance(address: string | null, enabled: boolean): { view: ShastaBalanceView; refresh: () => void } {
  const [slot, setSlot] = useState<Slot | null>(null)
  const [nonce, setNonce] = useState(0)
  const active = enabled && address !== null

  useEffect(() => {
    if (!active || !address) return
    const controller = new AbortController()
    setTimeout(() => setSlot((current) => ({ address, view: { status: 'loading', previous: lastKnown(current, address) } })), 0)
    fetchShastaBalance(address, { signal: controller.signal }).then(
      (balance) => { if (!controller.signal.aborted) setSlot({ address, view: { status: 'ready', balance } }) },
      (error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof ShastaBalanceError ? error.message : 'The balance could not be read.'
        setSlot((current) => ({ address, view: { status: 'error', message, previous: lastKnown(current, address) } }))
      },
    )
    return () => controller.abort()
  }, [active, address, nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  const view: ShastaBalanceView = !active ? { status: 'idle' } : slot && slot.address === address ? slot.view : { status: 'loading', previous: null }
  return { view, refresh }
}
