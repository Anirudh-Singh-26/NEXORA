import type { BlockchainErrorInfo, BlockchainErrorKind, ProviderAttempt } from './types.ts'

/** Internal error carrying a classified kind. Messages must never include URLs or response bodies. */
export class BlockchainError extends Error {
  kind: BlockchainErrorKind
  constructor(kind: BlockchainErrorKind, message: string) {
    super(message)
    this.name = 'BlockchainError'
    this.kind = kind
  }
}

const RETRYABLE: ReadonlySet<BlockchainErrorKind> = new Set(['timeout', 'rate-limited', 'network', 'http', 'malformed', 'cooldown'])

/** Kinds where another provider might answer. `rpc` (e.g. invalid params) is deterministic, so it is not retried elsewhere. */
export function isFallbackEligible(kind: BlockchainErrorKind): boolean {
  return kind === 'timeout' || kind === 'rate-limited' || kind === 'network' || kind === 'http' || kind === 'malformed' || kind === 'chain-mismatch'
}

export function isRetryable(kind: BlockchainErrorKind): boolean {
  return RETRYABLE.has(kind)
}

export function toInfo(error: BlockchainError, attempts: ProviderAttempt[] = []): BlockchainErrorInfo {
  return { kind: error.kind, message: error.message, retryable: isRetryable(error.kind), attempts }
}

export function userMessage(kind: BlockchainErrorKind): string {
  switch (kind) {
    case 'unsupported-network': return 'This network is not supported by NEXORA’s data layer.'
    case 'invalid-input': return 'The request was invalid.'
    case 'timeout': return 'The network provider took too long to respond.'
    case 'rate-limited': return 'The public provider is rate limiting requests. Try again shortly.'
    case 'network': return 'Could not reach the network provider. This can also be a browser CORS restriction.'
    case 'http': return 'The network provider returned an error.'
    case 'rpc': return 'The network provider rejected the request.'
    case 'malformed': return 'The network provider returned an unreadable response.'
    case 'chain-mismatch': return 'A provider answered for a different network and was ignored.'
    case 'cooldown': return 'Providers recently failed; waiting before trying again.'
    case 'aborted': return 'The request was cancelled.'
  }
}
