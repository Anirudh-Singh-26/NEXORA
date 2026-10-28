import { useEffect, useRef, useState, type RefObject } from 'react'
import { useAppKitProvider, useDisconnect } from '@reown/appkit/react'
import { createSolanaChangeListener, getStandardEvents, resolveSolanaAddress, type SolanaAddressOverride } from '@/lib/wallet/solana-standard-events'

/**
 * Keeps NEXORA in step with a Solana wallet that is changed from the wallet extension itself.
 *
 * AppKit's Solana adapter ignores a Wallet Standard `change` event whose account list is empty (an external disconnect)
 * and, for Solana, does not re-sync its account state on account switches (see src/lib/wallet/solana-standard-events.ts).
 * While a Solana account is connected this hook listens to that event on the wallet and
 *  - on an empty account list asks AppKit to disconnect the Solana namespace only (EVM is untouched; AppKit also records
 *    the connector as disconnected so a reload does not try to silently reconnect it), and
 *  - on a new first account returns that address so the displayed Solana address follows the wallet.
 * Events raised while NEXORA's own disconnect is running are ignored (`inAppDisconnect`). Listeners are removed on cleanup.
 * Nothing is polled and no wallet approval is requested.
 */
export function useSolanaExternalSync(appKitAddress: string | null, inAppDisconnect: RefObject<boolean>, onError: (message: string) => void): string | null {
  const { walletProvider } = useAppKitProvider('solana')
  const { disconnect } = useDisconnect()
  const [override, setOverride] = useState<SolanaAddressOverride | null>(null)
  // Latest callbacks live in refs so the wallet listener is not re-registered on every render.
  const onErrorRef = useRef(onError)
  const disconnectRef = useRef(disconnect)
  useEffect(() => { onErrorRef.current = onError; disconnectRef.current = disconnect }, [onError, disconnect])
  const connected = appKitAddress !== null

  useEffect(() => {
    if (!connected) return
    const events = getStandardEvents(walletProvider)
    // Not every Solana wallet is a Wallet Standard wallet; without the event AppKit's own behaviour applies unchanged.
    if (!events) return
    const subscription = createSolanaChangeListener({
      isInAppDisconnect: () => inAppDisconnect.current,
      onAccount: (address) => setOverride({ base: appKitAddress, address }),
      disconnect: () => disconnectRef.current({ namespace: 'solana' }),
      onDisconnectError: () => onErrorRef.current('Your Solana wallet was disconnected in the wallet app, but NEXORA could not clear it. Reload the page and reconnect if it still shows Connected.'),
    })
    const off = events.on('change', subscription.listener)
    return () => {
      subscription.dispose()
      if (typeof off === 'function') off()
      // A wallet-reported account belongs to this subscription only; never carry it into a later connection.
      setOverride(null)
    }
  }, [connected, appKitAddress, walletProvider, inAppDisconnect])

  return resolveSolanaAddress(appKitAddress, override)
}
