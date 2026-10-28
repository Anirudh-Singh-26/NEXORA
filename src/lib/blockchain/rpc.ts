import { BlockchainError } from './errors.ts'

export interface RpcCallOptions {
  fetchImpl: typeof fetch
  timeoutMs: number
  signal?: AbortSignal
}

function isRateLimitSignal(code: unknown, message: unknown): boolean {
  if (code === -32005 || code === 429) return true
  return typeof message === 'string' && /rate|limit|too many|quota/i.test(message)
}

/**
 * One read-only JSON-RPC call to a single endpoint. Throws BlockchainError with a classified kind.
 * Error messages are fixed strings: they never include the URL (which may embed a key) or the response body.
 */
export async function rpcCall(url: string, method: string, params: unknown[], options: RpcCallOptions): Promise<unknown> {
  const { fetchImpl, timeoutMs, signal } = options
  if (signal?.aborted) throw new BlockchainError('aborted', 'The request was cancelled.')

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  const classifyAbort = (): BlockchainError | null => {
    if (signal?.aborted) return new BlockchainError('aborted', 'The request was cancelled.')
    if (timedOut) return new BlockchainError('timeout', 'The network provider took too long to respond.')
    return null
  }

  try {
    let response: Response
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
    } catch {
      throw classifyAbort() ?? new BlockchainError('network', 'Could not reach the network provider.')
    }

    if (response.status === 429) throw new BlockchainError('rate-limited', 'The public provider is rate limiting requests.')
    if (!response.ok) throw new BlockchainError('http', 'The network provider returned an error.')

    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw classifyAbort() ?? new BlockchainError('malformed', 'The network provider returned an unreadable response.')
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new BlockchainError('malformed', 'The network provider returned an unreadable response.')
    }
    const envelope = body as { result?: unknown; error?: { code?: unknown; message?: unknown } | null }
    if (envelope.error !== undefined && envelope.error !== null) {
      if (isRateLimitSignal(envelope.error.code, envelope.error.message)) {
        throw new BlockchainError('rate-limited', 'The public provider is rate limiting requests.')
      }
      throw new BlockchainError('rpc', 'The network provider rejected the request.')
    }
    if (!('result' in envelope) || envelope.result === undefined || envelope.result === null) {
      throw new BlockchainError('malformed', 'The network provider returned no result.')
    }
    return envelope.result
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
