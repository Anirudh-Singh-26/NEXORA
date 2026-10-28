/**
 * Browser client for NEXORA's read-only `/api/wallet-nfts` proxy (Alchemy NFT API v3, server-side key; EVM only).
 * Pure TypeScript: no React. Responses are validated, and a response for a different chain/address than the one
 * requested is rejected, so another account's NFTs can never be attached to the current one.
 */
import { normalizeAddress } from '../blockchain/normalize.ts'
import { isNftChain } from './chains.ts'

export interface WalletNft {
  /** Lowercased contract address. */
  contract: string
  /** Decimal token id. */
  tokenId: string
  tokenType: 'ERC721' | 'ERC1155' | null
  name: string | null
  collectionName: string | null
  /** https preview URL, or null when the provider had none. */
  image: string | null
  balance: string | null
}

export interface WalletNftsPage {
  chainId: number
  address: string
  nfts: WalletNft[]
  nextPageKey: string | null
  totalCount: number | null
  hiddenSpam: number
}

export type WalletNftsErrorKind =
  | 'not-configured' | 'invalid-request' | 'rate-limited' | 'provider-auth' | 'chain-unsupported' | 'upstream'
  | 'proxy-missing' | 'network' | 'timeout' | 'malformed' | 'aborted'

export type WalletNftsResult =
  | { status: 'ok'; page: WalletNftsPage }
  | { status: 'error'; kind: WalletNftsErrorKind; message: string; retryable: boolean }

export type NftTarget =
  | { kind: 'no-wallet' }
  | { kind: 'invalid-address' }
  | { kind: 'unknown-network' }
  | { kind: 'unsupported-network'; chainId: number }
  | { kind: 'ready'; chainId: number; address: string }

/** Pure: can this account's NFTs be requested on this chain, and if not, why. */
export function resolveNftTarget(address: string | null, chainId: number | null): NftTarget {
  if (!address) return { kind: 'no-wallet' }
  const normalized = normalizeAddress(address)
  if (!normalized) return { kind: 'invalid-address' }
  if (chainId === null) return { kind: 'unknown-network' }
  if (!isNftChain(chainId)) return { kind: 'unsupported-network', chainId }
  return { kind: 'ready', chainId, address: normalized }
}

const MESSAGES: Record<WalletNftsErrorKind, string> = {
  'not-configured': 'NFT listing is not set up on this deployment (the server needs ALCHEMY_API_KEY).',
  'invalid-request': 'The NFT request was invalid.',
  'rate-limited': 'The NFT data provider is rate limiting requests. Try again shortly.',
  'provider-auth': 'The NFT data provider rejected the server credentials.',
  'chain-unsupported': 'The NFT data provider does not offer NFT ownership for this network on the configured plan.',
  upstream: 'The NFT data provider is unavailable right now.',
  'proxy-missing': 'The /api/wallet-nfts proxy is not reachable. Run the app with `npm run dev` or deploy it to Vercel with ALCHEMY_API_KEY set.',
  network: 'Could not reach the NFT proxy.',
  timeout: 'The NFT request took too long.',
  malformed: 'The NFT proxy returned an unreadable response.',
  aborted: 'The request was cancelled.',
}
const RETRYABLE: ReadonlySet<WalletNftsErrorKind> = new Set(['rate-limited', 'upstream', 'network', 'timeout', 'malformed'])
const SERVER_KINDS: ReadonlySet<string> = new Set(['not-configured', 'invalid-request', 'rate-limited', 'provider-auth', 'chain-unsupported', 'upstream'])

function failure(kind: WalletNftsErrorKind): WalletNftsResult {
  return { status: 'error', kind, message: MESSAGES[kind], retryable: RETRYABLE.has(kind) }
}

const CONTRACT_RE = /^0x[0-9a-f]{40}$/
const TOKEN_ID_RE = /^[0-9]{1,78}$/
const PAGE_KEY_RE = /^[A-Za-z0-9_\-=:.+/]{1,1024}$/

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null
}

/** Validates the proxy's JSON. Malformed or duplicate entries are dropped; a malformed envelope throws. */
export function parseWalletNftsResponse(body: unknown): WalletNftsPage {
  const root = body as Record<string, unknown> | null
  if (!root || typeof root !== 'object' || !Array.isArray(root.nfts) || typeof root.chainId !== 'number' || typeof root.address !== 'string') {
    throw new Error('malformed')
  }
  const seen = new Set<string>()
  const nfts: WalletNft[] = []
  for (const entry of root.nfts as Array<Record<string, unknown>>) {
    if (!entry || typeof entry !== 'object') continue
    const contract = typeof entry.contract === 'string' ? entry.contract.toLowerCase() : ''
    const tokenId = entry.tokenId
    if (!CONTRACT_RE.test(contract) || typeof tokenId !== 'string' || !TOKEN_ID_RE.test(tokenId)) continue
    const key = `${contract}:${tokenId}`
    if (seen.has(key)) continue
    seen.add(key)
    const image = typeof entry.image === 'string' && entry.image.startsWith('https://') && entry.image.length <= 2048 ? entry.image : null
    nfts.push({
      contract, tokenId,
      tokenType: entry.tokenType === 'ERC721' || entry.tokenType === 'ERC1155' ? entry.tokenType : null,
      name: text(entry.name, 96), collectionName: text(entry.collectionName, 80), image,
      balance: typeof entry.balance === 'string' && /^[0-9]{1,30}$/.test(entry.balance) ? entry.balance : null,
    })
  }
  const nextPageKey = typeof root.nextPageKey === 'string' && PAGE_KEY_RE.test(root.nextPageKey) ? root.nextPageKey : null
  const totalCount = typeof root.totalCount === 'number' && Number.isSafeInteger(root.totalCount) && root.totalCount >= 0 ? root.totalCount : null
  const hiddenSpam = typeof root.hiddenSpam === 'number' && Number.isSafeInteger(root.hiddenSpam) && root.hiddenSpam > 0 ? root.hiddenSpam : 0
  return { chainId: root.chainId, address: root.address.toLowerCase(), nfts, nextPageKey, totalCount, hiddenSpam }
}

export interface FetchOptions {
  pageKey?: string | null
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  endpoint?: string
  timeoutMs?: number
}

export async function fetchWalletNfts(chainId: number, address: string, options: FetchOptions = {}): Promise<WalletNftsResult> {
  const normalized = normalizeAddress(address)
  if (!normalized || !isNftChain(chainId)) return failure('invalid-request')
  const query = new URLSearchParams({ chainId: String(chainId), address: normalized })
  if (options.pageKey) query.set('pageKey', options.pageKey)

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, options.timeoutMs ?? 25_000)
  const onAbort = () => controller.abort()
  if (options.signal?.aborted) { clearTimeout(timer); return failure('aborted') }
  options.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await (options.fetchImpl ?? fetch)(`${options.endpoint ?? '/api/wallet-nfts'}?${query}`, { headers: { accept: 'application/json' }, signal: controller.signal })
    const contentType = response.headers.get('content-type') ?? ''
    // The SPA fallback serves index.html for unknown paths: that means the proxy is not deployed or not running.
    if (!contentType.includes('json')) return failure(response.status === 404 || contentType.includes('html') ? 'proxy-missing' : 'malformed')
    let body: unknown
    try { body = await response.json() } catch { return failure('malformed') }
    if (!response.ok) {
      const code = (body as { error?: { code?: unknown } } | null)?.error?.code
      return failure(typeof code === 'string' && SERVER_KINDS.has(code) ? (code as WalletNftsErrorKind) : 'upstream')
    }
    let page: WalletNftsPage
    try { page = parseWalletNftsResponse(body) } catch { return failure('malformed') }
    // Never accept data for a different account or chain than the one that was requested.
    if (page.chainId !== chainId || page.address !== normalized) return failure('malformed')
    return { status: 'ok', page }
  } catch {
    if (timedOut) return failure('timeout')
    if (options.signal?.aborted) return failure('aborted')
    return failure('network')
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

/** Fold a further page into the loaded list without duplicating assets. Pure. */
export function mergeNftPages(previous: readonly WalletNft[], next: readonly WalletNft[]): WalletNft[] {
  const known = new Set(previous.map((n) => `${n.contract}:${n.tokenId}`))
  return [...previous, ...next.filter((n) => !known.has(`${n.contract}:${n.tokenId}`))]
}
