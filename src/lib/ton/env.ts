import { resolveTonTestnetApiBase } from './balance.ts'
import { resolveTonManifestUrl } from './manifest.ts'

/**
 * TON runtime configuration, read from PUBLIC Vite variables (both are safe to ship to the browser):
 *  - VITE_TONCONNECT_MANIFEST_URL  optional; absolute URL of the TON Connect manifest. Default: <origin>/tonconnect-manifest.json
 *  - VITE_TON_TESTNET_API_URL      optional; TON Center-compatible v2 base URL for TESTNET. Default: https://testnet.toncenter.com/api/v2
 * No API key variable exists on purpose: a VITE_* value is readable by every visitor.
 * Browser-only (uses import.meta.env and window), so the pure, unit-tested logic lives in manifest.ts and balance.ts.
 */

export type TonRuntimeConfig =
  | { ok: true; manifestUrl: string; apiBase: string; customApi: boolean }
  | { ok: false; messages: string[] }

export function readTonConfig(): TonRuntimeConfig {
  const manifest = resolveTonManifestUrl(import.meta.env.VITE_TONCONNECT_MANIFEST_URL as string | undefined, window.location.origin)
  const api = resolveTonTestnetApiBase(import.meta.env.VITE_TON_TESTNET_API_URL as string | undefined)
  if (manifest.ok && api.ok) return { ok: true, manifestUrl: manifest.url, apiBase: api.base, customApi: api.custom }
  const messages: string[] = []
  if (!manifest.ok) messages.push(manifest.message)
  if (!api.ok) messages.push(api.message)
  return { ok: false, messages }
}
