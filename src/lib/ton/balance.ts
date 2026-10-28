import { WALLET_NETWORK_CONFIG } from '../wallet/network-config.ts'
import { isRawTonAddress } from './address.ts'
import { parseNanoTon } from './format.ts'

/**
 * Read-only native TON balance on TESTNET, in nanoTON (1 TON = 1,000,000,000 nanoTON).
 *
 * Data source: TON Center API v2 `GET /getAddressBalance` (https://docs.ton.org/ecosystem/api/toncenter/v2/overview).
 * The hosted testnet endpoint works WITHOUT an API key at a default limit of 1 request per second; an API key only
 * raises the limit. A key must never be placed in a VITE_* variable (it would ship to every browser), so this
 * client never sends one. To use a keyed provider, point VITE_TON_TESTNET_API_URL at your own server-side proxy.
 */

export const TON_TESTNET_API_URL = WALLET_NETWORK_CONFIG.ton.testnet.apiBaseUrl

/** Hosts known to serve MAINNET data. A mainnet endpoint must never answer a testnet wallet's balance request. */
const KNOWN_MAINNET_HOSTS = new Set(['toncenter.com', 'www.toncenter.com'])

export type TonApiBaseResult = { ok: true; base: string; custom: boolean } | { ok: false; message: string }

/**
 * Validates the configurable data-source base URL. Accepts https (or http on localhost), with no credentials,
 * query string or fragment (which also stops `?api_key=...` from being baked into client config).
 */
export function resolveTonTestnetApiBase(raw: string | undefined | null): TonApiBaseResult {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (value === '') return { ok: true, base: TON_TESTNET_API_URL, custom: false }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { ok: false, message: 'VITE_TON_TESTNET_API_URL is not a valid absolute URL.' }
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return { ok: false, message: 'VITE_TON_TESTNET_API_URL must use https (http is allowed only for localhost).' }
  if (url.username || url.password) return { ok: false, message: 'VITE_TON_TESTNET_API_URL must not contain credentials.' }
  if (url.search || url.hash) return { ok: false, message: 'VITE_TON_TESTNET_API_URL must not contain a query string or fragment. Never put an API key in a VITE_* variable.' }
  if (KNOWN_MAINNET_HOSTS.has(url.hostname)) return { ok: false, message: 'VITE_TON_TESTNET_API_URL points at a TON mainnet host. A testnet endpoint is required.' }
  return { ok: true, base: `${url.origin}${url.pathname.replace(/\/+$/, '')}`, custom: true }
}

export interface TonBalance {
  nano: bigint
  /** Raw address the balance was read for. */
  address: string
  retrievedAt: number
}

export type TonBalanceErrorKind = 'invalid-address' | 'network' | 'rate-limited' | 'auth' | 'http' | 'bad-response'

export class TonBalanceError extends Error {
  readonly kind: TonBalanceErrorKind
  constructor(kind: TonBalanceErrorKind, message: string) {
    super(message)
    this.name = 'TonBalanceError'
    this.kind = kind
  }
}

export interface FetchTonBalanceOptions {
  /** Base URL from {@link resolveTonTestnetApiBase}. Defaults to the public TON Center testnet endpoint. */
  base?: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  now?: () => number
}

/**
 * GET {base}/getAddressBalance?address=<raw>. Expected body: `{ "ok": true, "result": "<nanoTON as decimal string>" }`.
 * Throws {@link TonBalanceError}; rethrows AbortError untouched. Callers must have passed the testnet gate first:
 * this function does not know which network the wallet is on.
 */
export async function fetchTonTestnetBalance(address: string, options: FetchTonBalanceOptions = {}): Promise<TonBalance> {
  if (!isRawTonAddress(address)) throw new TonBalanceError('invalid-address', 'The wallet returned an address that is not a valid TON address.')
  const doFetch = options.fetchImpl ?? fetch
  const url = `${options.base ?? TON_TESTNET_API_URL}/getAddressBalance?address=${encodeURIComponent(address)}`
  let response: Response
  try {
    response = await doFetch(url, { method: 'GET', headers: { accept: 'application/json' }, signal: options.signal, cache: 'no-store', credentials: 'omit' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new TonBalanceError('network', 'Could not reach the TON testnet data service. Check your connection and try again.')
  }
  if (response.status === 429) throw new TonBalanceError('rate-limited', 'The TON testnet data service is rate-limiting requests (the keyless limit is about 1 per second). Wait a moment and try again.')
  if (response.status === 401 || response.status === 403) throw new TonBalanceError('auth', `The TON testnet data service refused the request (HTTP ${response.status}).`)
  if (!response.ok) throw new TonBalanceError('http', `The TON testnet data service answered with HTTP ${response.status}.`)

  let body: unknown
  try {
    body = JSON.parse(await response.text())
  } catch {
    throw new TonBalanceError('bad-response', 'The TON testnet data service returned a response that is not valid JSON.')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new TonBalanceError('bad-response', 'The TON testnet data service returned an unexpected response shape.')
  const record = body as Record<string, unknown>
  if (record.ok !== true) {
    if (record.code === 429) throw new TonBalanceError('rate-limited', 'The TON testnet data service is rate-limiting requests. Wait a moment and try again.')
    throw new TonBalanceError('bad-response', 'The TON testnet data service rejected the request.')
  }
  const nano = parseNanoTon(record.result)
  if (nano === null) throw new TonBalanceError('bad-response', 'The TON testnet data service returned a balance that is not a whole number of nanoTON.')
  return { nano, address, retrievedAt: (options.now ?? Date.now)() }
}
