import { useEffect, useState } from 'react'
import { checkTonManifest, type TonManifestCheck } from '@/lib/ton/manifest'

export type TonManifestStatus =
  | { status: 'checking' }
  | { status: 'unavailable'; message: string }
  | TonManifestCheck

/**
 * Fetches NEXORA's own TON Connect manifest once and reports whether it is usable. Only the shipped placeholder is
 * treated as blocking (it is certain to fail inside the wallet); an unreachable or odd manifest is reported but does
 * not stop the user from trying, because a cross-origin manifest may be unreadable from here yet fine for wallets.
 */
export function useTonManifestStatus(manifestUrl: string): TonManifestStatus {
  const [result, setResult] = useState<{ url: string; value: TonManifestStatus } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(manifestUrl, { cache: 'no-store', credentials: 'omit', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return { status: 'unavailable', message: `The manifest answered with HTTP ${response.status}.` } satisfies TonManifestStatus
        let json: unknown
        try {
          json = JSON.parse(await response.text())
        } catch {
          return { status: 'unavailable', message: 'The manifest URL did not return JSON (the file may be missing).' } satisfies TonManifestStatus
        }
        return checkTonManifest(json, window.location.origin)
      })
      .catch((): TonManifestStatus | null => (controller.signal.aborted ? null : { status: 'unavailable', message: 'The manifest could not be fetched from this page.' }))
      .then((value) => { if (value && !controller.signal.aborted) setResult({ url: manifestUrl, value }) })
    return () => controller.abort()
  }, [manifestUrl])

  return result && result.url === manifestUrl ? result.value : { status: 'checking' }
}
