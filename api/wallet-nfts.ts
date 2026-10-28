import { WALLET_NETWORK_CONFIG } from '../src/lib/wallet/network-config.ts'
/**
 * GET /api/wallet-nfts?chainId=<id>&address=<0x…>[&pageKey=<cursor>]
 *
 * Read-only proxy for the NFTs an EVM address owns, using Alchemy's NFT API v3 `getNFTsForOwner`. Reuses the existing
 * server-only ALCHEMY_API_KEY (no VITE_ prefix): it is never sent to the browser, logged, or put in a response.
 * Not an open relay: GET only, a fixed upstream path, chainId from an allow-list, address and cursor validated,
 * page size fixed. EVM only: Solana NFTs are NOT served here (different provider API).
 *
 * Responses: 200 { chainId, address, nfts[], nextPageKey, totalCount, hiddenSpam, provider } or
 *            { error: { code, message } } with an HTTP status. No URL or key ever appears in an error.
 */
import { NFT_CHAINS, isNftChain } from '../src/lib/wallet-nfts/chains.ts'

export const PAGE_SIZE = 24
const UPSTREAM_TIMEOUT_MS = 12_000
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const PAGE_KEY_RE = /^[A-Za-z0-9_\-=:.+/]{1,1024}$/
const TOKEN_ID_RE = /^[0-9]{1,78}$/

export type ErrorCode = 'not-configured' | 'invalid-request' | 'method-not-allowed' | 'rate-limited' | 'provider-auth' | 'chain-unsupported' | 'upstream'

export interface ProxyNft {
  contract: string
  tokenId: string
  tokenType: 'ERC721' | 'ERC1155' | null
  name: string | null
  collectionName: string | null
  image: string | null
  /** ERC-1155 quantity as an integer string; null for ERC-721 or when not reported. */
  balance: string | null
}

export interface HandlerOptions { apiKey?: string; fetchImpl?: typeof fetch }

class ProxyError extends Error {
  code: ErrorCode
  status: number
  constructor(code: ErrorCode, status: number) { super(code); this.code = code; this.status = status }
}

const MESSAGES: Record<ErrorCode, string> = {
  'not-configured': 'The NFT data provider is not configured on the server (ALCHEMY_API_KEY is missing).',
  'invalid-request': 'The request was invalid.',
  'method-not-allowed': 'Only GET is supported.',
  'rate-limited': 'The NFT data provider is rate limiting requests. Try again shortly.',
  'provider-auth': 'The NFT data provider rejected the server credentials.',
  'chain-unsupported': 'The NFT data provider does not offer NFT ownership for this network on the configured plan.',
  upstream: 'The NFT data provider is unavailable right now.',
}

function json(body: unknown, status = 200): Response {
  // Per-address data: never let a shared cache store or reuse it.
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' } })
}
const failure = (code: ErrorCode, status: number) => json({ error: { code, message: MESSAGES[code] } }, status)

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** NFT names/collections are chosen by whoever minted them: strip control/bidi characters and cap the length. */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '').trim()
  return cleaned ? cleaned.slice(0, max) : null
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null } catch { return null }
}

function tokenIdOf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (TOKEN_ID_RE.test(value)) return BigInt(value).toString()
  if (/^0x[0-9a-fA-F]{1,64}$/.test(value)) return BigInt(value).toString()
  return null
}

/** Alchemy `image` object → the best https preview URL (thumbnail first, original last). */
function pickImage(image: unknown): string | null {
  if (!isRecord(image)) return null
  for (const key of ['thumbnailUrl', 'cachedUrl', 'pngUrl', 'originalUrl']) {
    const url = httpsUrl(image[key])
    if (url) return url
  }
  return null
}

/**
 * Pure parser (exported for tests). Keeps well-formed, de-duplicated, non-spam NFTs; drops anything malformed.
 * A malformed envelope throws. Spam-flagged contracts are hidden and counted (never silently shown as holdings).
 */
export function parseOwnedNfts(body: unknown): { nfts: ProxyNft[]; nextPageKey: string | null; totalCount: number | null; hiddenSpam: number } {
  if (!isRecord(body) || !Array.isArray(body.ownedNfts)) throw new ProxyError('upstream', 502)
  const seen = new Set<string>()
  const nfts: ProxyNft[] = []
  let hiddenSpam = 0
  for (const entry of body.ownedNfts) {
    if (!isRecord(entry) || !isRecord(entry.contract)) continue
    const address = entry.contract.address
    if (typeof address !== 'string' || !ADDRESS_RE.test(address)) continue
    const tokenId = tokenIdOf(entry.tokenId)
    if (tokenId === null) continue
    const contract = address.toLowerCase()
    const key = `${contract}:${tokenId}`
    if (seen.has(key)) continue
    seen.add(key)
    if (entry.contract.isSpam === true) { hiddenSpam += 1; continue }
    const type = entry.tokenType ?? entry.contract.tokenType
    const opensea = isRecord(entry.contract.openSeaMetadata) ? entry.contract.openSeaMetadata : null
    nfts.push({
      contract, tokenId,
      tokenType: type === 'ERC721' || type === 'ERC1155' ? type : null,
      name: cleanText(entry.name, 96),
      collectionName: cleanText(opensea?.collectionName, 80) ?? cleanText(entry.contract.name, 80),
      image: pickImage(entry.image),
      balance: typeof entry.balance === 'string' && /^[0-9]{1,30}$/.test(entry.balance) ? entry.balance : null,
    })
  }
  const nextPageKey = typeof body.pageKey === 'string' && PAGE_KEY_RE.test(body.pageKey) ? body.pageKey : null
  const totalCount = typeof body.totalCount === 'number' && Number.isSafeInteger(body.totalCount) && body.totalCount >= 0 ? body.totalCount : null
  return { nfts, nextPageKey, totalCount, hiddenSpam }
}

function mapProviderFailure(status: number, body: unknown): ProxyError | null {
  if (status === 429) return new ProxyError('rate-limited', 429)
  if (status === 401 || status === 403) return new ProxyError('provider-auth', 502)
  const message = isRecord(body) && typeof body.message === 'string' ? body.message.toLowerCase() : ''
  if (status === 400 || status === 404 || status === 422) {
    if (message.includes('not enabled') || message.includes('not supported') || message.includes('not available')) return new ProxyError('chain-unsupported', 422)
  }
  if (status < 200 || status >= 300) return new ProxyError('upstream', 502)
  return null
}

export async function handleWalletNfts(request: Request, options: HandlerOptions = {}): Promise<Response> {
  if (request.method !== 'GET') return failure('method-not-allowed', 405)
  if (!options.apiKey) return failure('not-configured', 503)
  const params = new URL(request.url).searchParams
  const chainText = params.get('chainId') ?? ''
  const chainId = /^[0-9]{1,12}$/.test(chainText) ? Number(chainText) : NaN
  const address = params.get('address') ?? ''
  const pageKey = params.get('pageKey')
  if (!isNftChain(chainId) || !ADDRESS_RE.test(address) || (pageKey !== null && !PAGE_KEY_RE.test(pageKey))) return failure('invalid-request', 400)

  const normalized = address.toLowerCase()
  const query = new URLSearchParams({ owner: normalized, withMetadata: 'true', pageSize: String(PAGE_SIZE) })
  if (pageKey) query.set('pageKey', pageKey)
  const url = `https://${NFT_CHAINS[chainId].alchemy}${WALLET_NETWORK_CONFIG.providers.alchemyNftHostSuffix}/${encodeURIComponent(options.apiKey)}/getNFTsForOwner?${query}`
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args))

  try {
    let response: Response
    try {
      response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
    } catch {
      // The thrown error can mention the URL (which contains the key): never forward it.
      throw new ProxyError('upstream', 502)
    }
    let body: unknown = null
    try { body = await response.json() } catch { /* non-JSON body */ }
    const problem = mapProviderFailure(response.status, body)
    if (problem) throw problem
    const parsed = parseOwnedNfts(body)
    return json({ chainId, address: normalized, ...parsed, provider: 'alchemy' })
  } catch (cause) {
    if (cause instanceof ProxyError) return failure(cause.code, cause.status)
    return failure('upstream', 502)
  }
}

/** Vercel Function entry (Web-standard handler). Reads the key from the server environment only. */
export async function GET(request: Request): Promise<Response> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return handleWalletNfts(request, { apiKey: env?.ALCHEMY_API_KEY })
}
