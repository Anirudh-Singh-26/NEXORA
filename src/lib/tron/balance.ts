import { SHASTA_API_URL } from './network.ts'
import { looksLikeTronAddress, parseSun } from './format.ts'

/** Read-only native TRX balance on Shasta, in SUN (1 TRX = 1,000,000 SUN). */
export interface ShastaBalance {
  sun: bigint
  /**
   * False when the node returned an empty account object, which is how a never-activated
   * address appears (documented behaviour is not explicit, so this is reported as "no
   * account record", not as a fact about the address's history).
   */
  hasAccountRecord: boolean
  retrievedAt: number
}

export class ShastaBalanceError extends Error {
  readonly kind: 'invalid-address' | 'network' | 'http' | 'bad-response'
  constructor(kind: ShastaBalanceError['kind'], message: string) {
    super(message)
    this.name = 'ShastaBalanceError'
    this.kind = kind
  }
}

/** The ONLY URL balance reads use. Built from the fixed Shasta constant; no parameters can change the host. */
export const SHASTA_GETACCOUNT_URL = `${SHASTA_API_URL}/wallet/getaccount`

export interface FetchShastaBalanceOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  now?: () => number
}

/** Extract the top-level integer "balance" from raw JSON text without float rounding (used only past 2^53). */
function exactBalanceFromText(text: string): bigint | null {
  const match = /"balance"\s*:\s*(\d+)\s*[,}]/.exec(text)
  return match ? BigInt(match[1]) : null
}

/**
 * POST /wallet/getaccount on the fixed Shasta endpoint with `visible: true` (base58 address).
 * Missing `balance` on an existing account record means 0 SUN. Throws {@link ShastaBalanceError}.
 */
export async function fetchShastaBalance(address: string, options: FetchShastaBalanceOptions = {}): Promise<ShastaBalance> {
  if (!looksLikeTronAddress(address)) throw new ShastaBalanceError('invalid-address', 'The wallet returned an address that is not a valid TRON address.')
  const doFetch = options.fetchImpl ?? fetch
  let response: Response
  try {
    response = await doFetch(SHASTA_GETACCOUNT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ address, visible: true }),
      signal: options.signal,
      cache: 'no-store',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ShastaBalanceError('network', 'Could not reach the Shasta node. Check your connection and try again.')
  }
  if (!response.ok) throw new ShastaBalanceError('http', `The Shasta node answered with HTTP ${response.status}.`)

  let text: string
  let body: unknown
  try {
    text = await response.text()
    body = JSON.parse(text)
  } catch {
    throw new ShastaBalanceError('bad-response', 'The Shasta node returned a response that is not valid JSON.')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new ShastaBalanceError('bad-response', 'The Shasta node returned an unexpected response shape.')
  const record = body as Record<string, unknown>
  if (typeof record.Error === 'string' || typeof record.code === 'string') {
    throw new ShastaBalanceError('bad-response', 'The Shasta node rejected the request.')
  }

  const retrievedAt = (options.now ?? Date.now)()
  if (Object.keys(record).length === 0) return { sun: 0n, hasAccountRecord: false, retrievedAt }
  if (!('balance' in record)) return { sun: 0n, hasAccountRecord: true, retrievedAt }

  const raw = record.balance
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > Number.MAX_SAFE_INTEGER) {
    const exact = exactBalanceFromText(text)
    if (exact !== null) return { sun: exact, hasAccountRecord: true, retrievedAt }
    throw new ShastaBalanceError('bad-response', 'The balance was too large to read exactly.')
  }
  const sun = parseSun(raw)
  if (sun === null) throw new ShastaBalanceError('bad-response', 'The Shasta node returned a balance that is not a whole number of SUN.')
  return { sun, hasAccountRecord: true, retrievedAt }
}
