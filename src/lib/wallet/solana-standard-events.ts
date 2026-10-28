/**
 * Pure helpers (no React, no env) for observing a Solana Wallet Standard wallet from outside AppKit.
 *
 * Why this exists: in @reown/appkit-adapter-solana 1.8.24, WalletStandardProvider only forwards a Wallet Standard
 * `change` event as `accountsChanged` when the new account list is NON-empty, so a wallet that disconnects from its own
 * extension (accounts becomes []) never reaches AppKit. NEXORA subscribes to the same event itself and asks AppKit to
 * disconnect through its public API. Everything here is defensive because the provider shape is a dependency internal.
 */

export type SolanaWalletChange =
  | { kind: 'disconnected' }
  | { kind: 'account'; address: string }
  | { kind: 'ignore' }

export interface StandardEventsFeature {
  on: (event: 'change', listener: (properties: unknown) => void) => () => void
}

/** Returns the wallet's `standard:events` feature when the AppKit Solana provider wraps a Wallet Standard wallet. */
export function getStandardEvents(provider: unknown): StandardEventsFeature | null {
  if (typeof provider !== 'object' || provider === null) return null
  const wallet = (provider as { wallet?: unknown }).wallet
  if (typeof wallet !== 'object' || wallet === null) return null
  const features = (wallet as { features?: unknown }).features
  if (typeof features !== 'object' || features === null) return null
  const feature = (features as Record<string, unknown>)['standard:events']
  if (typeof feature !== 'object' || feature === null) return null
  return typeof (feature as { on?: unknown }).on === 'function' ? (feature as StandardEventsFeature) : null
}

/**
 * Classifies a Wallet Standard `change` payload. Only a payload that carries an `accounts` array is meaningful: an empty
 * array means the wallet no longer exposes an account to this site; otherwise the first account is the active one
 * (the same account AppKit's provider reads). Chain/feature-only changes are ignored.
 */
export function classifyStandardChange(properties: unknown): SolanaWalletChange {
  if (typeof properties !== 'object' || properties === null) return { kind: 'ignore' }
  const accounts = (properties as { accounts?: unknown }).accounts
  if (!Array.isArray(accounts)) return { kind: 'ignore' }
  if (accounts.length === 0) return { kind: 'disconnected' }
  const first: unknown = accounts[0]
  const address = typeof first === 'object' && first !== null ? (first as { address?: unknown }).address : undefined
  return typeof address === 'string' && address.length > 0 ? { kind: 'account', address } : { kind: 'ignore' }
}

export interface SolanaAddressOverride { base: string | null; address: string }

/**
 * The live wallet account only overrides AppKit's address while AppKit still reports the address that was current when
 * the wallet event arrived. As soon as AppKit's own address changes (reconnect, a later sync) the override is ignored.
 */
export function resolveSolanaAddress(appKitAddress: string | null, override: SolanaAddressOverride | null): string | null {
  if (!appKitAddress) return null
  return override && override.base === appKitAddress ? override.address : appKitAddress
}

export interface SolanaChangeListenerOptions {
  /** True while NEXORA's own disconnect is running, so its echo from the wallet is not treated as an external event. */
  isInAppDisconnect: () => boolean
  /** The wallet's active account changed without disconnecting. */
  onAccount: (address: string) => void
  /** Ask AppKit to disconnect the Solana namespace only. */
  disconnect: () => Promise<unknown>
  /** The disconnect request itself failed (NEXORA state may still show Connected). */
  onDisconnectError: () => void
}

/**
 * Builds the `change` listener for one subscription. Guarantees:
 *  - events during an in-app disconnect are ignored;
 *  - repeated empty-account events trigger ONE disconnect request while it is in flight (a failed request re-arms it);
 *  - once disposed (effect cleanup, wallet/account replaced) a late event from the old subscription does nothing.
 */
export function createSolanaChangeListener(options: SolanaChangeListenerOptions): { listener: (properties: unknown) => void; dispose: () => void } {
  let disposed = false
  let disconnecting = false
  return {
    dispose: () => { disposed = true },
    listener: (properties) => {
      if (disposed || disconnecting || options.isInAppDisconnect()) return
      const change = classifyStandardChange(properties)
      if (change.kind === 'account') options.onAccount(change.address)
      else if (change.kind === 'disconnected') {
        disconnecting = true
        options.disconnect().catch(() => { if (!disposed) options.onDisconnectError() }).finally(() => { disconnecting = false })
      }
    },
  }
}
