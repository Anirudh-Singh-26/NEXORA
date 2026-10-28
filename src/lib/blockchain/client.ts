import { BoundedCache } from './cache.ts'
import { BlockchainError, isFallbackEligible, isRetryable, toInfo, userMessage } from './errors.ts'
import { buildChains, parseChainId, resolveChain, type EnvSource } from './networks.ts'
import { normalizeAddress, normalizeBalance, normalizeSnapshot, parseQuantity } from './normalize.ts'
import { rpcCall } from './rpc.ts'
import type {
  BlockchainErrorInfo, BlockchainErrorKind, ChainConfig, ChainId, ChainResult, ChainSnapshot, NativeBalance,
  Provenance, ProviderAttempt, RequestOptions, RpcEndpoint,
} from './types.ts'

export interface FreshnessPolicy {
  /** Served as fresh (no network) while younger than this. */
  freshMs: number
  /** Kept this long; served as stale only when every provider fails. */
  maxStaleMs: number
}

export interface ClientOptions {
  fetch?: typeof fetch
  now?: () => number
  env?: EnvSource
  timeoutMs?: number
  maxCacheEntries?: number
  snapshotPolicy?: FreshnessPolicy
  balancePolicy?: FreshnessPolicy
  /** A forced refresh within this window of the last fetch is answered from cache. */
  minRefreshMs?: number
  /** How long a failing endpoint is skipped, by failure kind. */
  cooldownMs?: Partial<Record<BlockchainErrorKind, number>>
}

interface CacheValue<T> {
  data: T
  source: string
  sourceKind: RpcEndpoint['kind']
  retrievedAt: number
  fallbackFrom: string[]
  latencyMs: number | null
}

interface InFlight<T> { promise: Promise<ChainResult<T>>; controller: AbortController; refs: number }

type DataKind = 'snapshot' | 'balance'

const DEFAULT_COOLDOWN: Partial<Record<BlockchainErrorKind, number>> = { 'rate-limited': 60_000, 'chain-mismatch': 600_000, timeout: 15_000, network: 15_000, http: 15_000, malformed: 15_000 }

function unavailable<T>(error: BlockchainErrorInfo, chainId: ChainId | null): ChainResult<T> {
  return { status: 'unavailable', error, chainId }
}

function simpleError<T>(kind: BlockchainErrorKind, chainId: ChainId | null): ChainResult<T> {
  return unavailable({ kind, message: userMessage(kind), retryable: isRetryable(kind), attempts: [] }, chainId)
}

export function createBlockchainClient(options: ClientOptions = {}) {
  const fetchImpl: typeof fetch = options.fetch ?? ((...args) => globalThis.fetch(...args))
  const now = options.now ?? (() => Date.now())
  const timeoutMs = options.timeoutMs ?? 8000
  const snapshotPolicy = options.snapshotPolicy ?? { freshMs: 15_000, maxStaleMs: 5 * 60_000 }
  const balancePolicy = options.balancePolicy ?? { freshMs: 15_000, maxStaleMs: 2 * 60_000 }
  const minRefreshMs = options.minRefreshMs ?? 2_000
  const cooldownMs = { ...DEFAULT_COOLDOWN, ...options.cooldownMs }
  const chains = buildChains(options.env ?? {})
  const snapshots = new BoundedCache<CacheValue<ChainSnapshot>>(options.maxCacheEntries ?? 64)
  const balances = new BoundedCache<CacheValue<NativeBalance>>(options.maxCacheEntries ?? 64)
  const inflight = new Map<string, InFlight<unknown>>()
  const cooldowns = new Map<string, { until: number; kind: BlockchainErrorKind }>()

  type Runner<T> = (call: (method: string, params?: unknown[]) => Promise<unknown>) => Promise<T>

  async function fromProviders<T>(
    chain: ChainConfig, runner: Runner<T>, signal: AbortSignal,
  ): Promise<{ ok: true; data: T; endpoint: RpcEndpoint; latencyMs: number; fallbackFrom: string[] } | { ok: false; error: BlockchainErrorInfo }> {
    const attempts: ProviderAttempt[] = []
    let skipped = 0
    for (const endpoint of chain.endpoints) {
      const cooldownKey = `${chain.chainId}:${endpoint.id}`
      const cooling = cooldowns.get(cooldownKey)
      if (cooling && cooling.until > now()) {
        skipped += 1
        attempts.push({ source: endpoint.id, kind: cooling.kind, message: 'Skipped after a recent failure.' })
        continue
      }
      const started = now()
      try {
        const call = (method: string, params: unknown[] = []) => rpcCall(endpoint.url, method, params, { fetchImpl, timeoutMs, signal })
        // Every network fetch is paired with eth_chainId, so each answer proves which chain that provider served.
        const [chainHex, data] = await Promise.all([call('eth_chainId'), runner(call)])
        if (Number(parseQuantity(chainHex)) !== chain.chainId) throw new BlockchainError('chain-mismatch', userMessage('chain-mismatch'))
        cooldowns.delete(cooldownKey)
        return { ok: true, data, endpoint, latencyMs: Math.max(0, now() - started), fallbackFrom: attempts.map((item) => item.source) }
      } catch (cause) {
        const error = cause instanceof BlockchainError ? cause : new BlockchainError('malformed', userMessage('malformed'))
        if (error.kind === 'aborted') return { ok: false, error: toInfo(error, attempts) }
        attempts.push({ source: endpoint.id, kind: error.kind, message: error.message })
        const wait = cooldownMs[error.kind]
        if (wait) cooldowns.set(cooldownKey, { until: now() + wait, kind: error.kind })
        if (!isFallbackEligible(error.kind)) return { ok: false, error: toInfo(error, attempts) }
      }
    }
    if (chain.endpoints.length > 0 && skipped === chain.endpoints.length) {
      return { ok: false, error: { kind: 'cooldown', message: userMessage('cooldown'), retryable: true, attempts } }
    }
    const last = attempts[attempts.length - 1]
    const kind = last?.kind ?? 'network'
    return { ok: false, error: { kind, message: userMessage(kind), retryable: isRetryable(kind), attempts } }
  }

  /** Deduplicates identical concurrent requests. The shared request is aborted only when every caller has left. */
  function shared<T>(key: string, signal: AbortSignal | undefined, chainId: ChainId, task: (signal: AbortSignal) => Promise<ChainResult<T>>): Promise<ChainResult<T>> {
    let entry = inflight.get(key) as InFlight<T> | undefined
    if (!entry) {
      const controller = new AbortController()
      const created: InFlight<T> = { controller, refs: 0, promise: Promise.resolve(simpleError<T>('network', chainId)) }
      created.promise = task(controller.signal).finally(() => { if (inflight.get(key) === created) inflight.delete(key) })
      inflight.set(key, created as InFlight<unknown>)
      entry = created
    }
    const current = entry
    current.refs += 1
    return new Promise<ChainResult<T>>((resolve) => {
      let done = false
      const finish = (result: ChainResult<T>) => {
        if (done) return
        done = true
        signal?.removeEventListener('abort', onAbort)
        resolve(result)
      }
      const onAbort = () => {
        current.refs -= 1
        if (current.refs <= 0) {
          current.controller.abort()
          if (inflight.get(key) === current) inflight.delete(key)
        }
        finish(simpleError<T>('aborted', chainId))
      }
      if (signal?.aborted) { onAbort(); return }
      signal?.addEventListener('abort', onAbort, { once: true })
      current.promise.then(finish, () => finish(simpleError<T>('network', chainId)))
    })
  }

  function provenance<T>(chain: ChainConfig, value: CacheValue<T>, flags: { fromCache: boolean; stale: boolean }): Provenance {
    return {
      chainId: chain.chainId, networkName: chain.name, source: value.source, sourceKind: value.sourceKind,
      retrievedAt: value.retrievedAt, fromCache: flags.fromCache, stale: flags.stale, ageMs: Math.max(0, now() - value.retrievedAt),
      endpointChainMatched: true, fallbackFrom: value.fallbackFrom, latencyMs: flags.fromCache ? null : value.latencyMs,
    }
  }

  async function read<T>(
    kind: DataKind, cache: BoundedCache<CacheValue<T>>, policy: FreshnessPolicy, chain: ChainConfig, keyExtra: string,
    runner: Runner<T>, request: RequestOptions,
  ): Promise<ChainResult<T>> {
    const key = `${kind}:${chain.chainId}:${keyExtra}`
    const cached = cache.get(key, now())
    if (cached) {
      const age = now() - cached.value.retrievedAt
      const useFresh = !request.forceRefresh && age <= policy.freshMs
      const tooSoon = request.forceRefresh === true && age < minRefreshMs
      if (useFresh || tooSoon) return { status: 'ok', data: cached.value.data, provenance: provenance(chain, cached.value, { fromCache: true, stale: false }), refreshError: null }
    }
    return shared<T>(key, request.signal, chain.chainId, async (signal) => {
      const result = await fromProviders(chain, runner, signal)
      if (result.ok) {
        const value: CacheValue<T> = { data: result.data, source: result.endpoint.id, sourceKind: result.endpoint.kind, retrievedAt: now(), fallbackFrom: result.fallbackFrom, latencyMs: result.latencyMs }
        cache.set(key, value, now(), policy.maxStaleMs)
        return { status: 'ok', data: value.data, provenance: provenance(chain, value, { fromCache: false, stale: false }), refreshError: null }
      }
      const previous = result.error.kind === 'aborted' ? undefined : cache.get(key, now())
      if (previous) {
        return { status: 'ok', data: previous.value.data, provenance: provenance(chain, previous.value, { fromCache: true, stale: true }), refreshError: result.error }
      }
      return unavailable(result.error, chain.chainId)
    })
  }

  return {
    listChains(): readonly ChainConfig[] { return chains },
    resolveChain(input: unknown): ChainConfig | null { return resolveChain(chains, input) },

    async getChainSnapshot(chainInput: unknown, request: RequestOptions = {}): Promise<ChainResult<ChainSnapshot>> {
      const chain = resolveChain(chains, chainInput)
      if (!chain) return simpleError('unsupported-network', parseChainId(chainInput))
      return read('snapshot', snapshots, snapshotPolicy, chain, '', async (call) => {
        const [block, gas] = await Promise.all([call('eth_blockNumber'), call('eth_gasPrice')])
        return normalizeSnapshot(chain.chainId, block, gas)
      }, request)
    },

    /** Reads a public address's native balance. The address is sent to the RPC provider, like any RPC query. */
    async getNativeBalance(chainInput: unknown, addressInput: unknown, request: RequestOptions = {}): Promise<ChainResult<NativeBalance>> {
      const chain = resolveChain(chains, chainInput)
      if (!chain) return simpleError('unsupported-network', parseChainId(chainInput))
      const address = normalizeAddress(addressInput)
      if (!address) return simpleError('invalid-input', chain.chainId)
      return read('balance', balances, balancePolicy, chain, address, async (call) => {
        const balance = await call('eth_getBalance', [address, 'latest'])
        return normalizeBalance(chain.chainId, address, balance, chain.nativeDecimals, chain.nativeSymbol)
      }, request)
    },

    /** Test/debug helper: drops cached data and endpoint cooldowns. */
    reset(): void { snapshots.clear(); balances.clear(); cooldowns.clear() },
  }
}

export type BlockchainClient = ReturnType<typeof createBlockchainClient>

function readViteEnv(): EnvSource {
  const meta = import.meta as unknown as { env?: EnvSource }
  return meta.env ?? {}
}

/** Application-wide client. Public Vite env values are bundled into the page: never put secrets in them. */
export const blockchain: BlockchainClient = createBlockchainClient({ env: readViteEnv() })
