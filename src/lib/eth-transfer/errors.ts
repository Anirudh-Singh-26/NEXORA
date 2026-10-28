/**
 * Maps whatever a wallet, wagmi/viem or NEXORA's own transfer code throws to one of a fixed set of outcomes with a plain
 * message. Matches on message text and numeric codes only (class names get mangled by minifiers) and never echoes raw
 * internals, URLs or provider text.
 */
export type EthFailureKind =
  | 'user-rejected' | 'insufficient-funds' | 'network-mismatch' | 'wallet-unavailable' | 'wallet-mismatch'
  | 'rpc-failure' | 'timeout' | 'gas-estimation' | 'invalid-hash' | 'unknown'

export interface EthFailure { kind: EthFailureKind; message: string }

const MESSAGES: Record<EthFailureKind, string> = {
  'user-rejected': 'You declined the request in your wallet. Nothing was sent.',
  'insufficient-funds': 'Not enough Sepolia ETH to cover the amount and the network fee. Nothing was sent.',
  'network-mismatch': 'Your wallet is not on Sepolia, so NEXORA stopped. Switch your wallet to Sepolia and try again. Nothing was sent.',
  'wallet-unavailable': 'Your wallet could not be reached. Reconnect your Ethereum wallet and try again. Nothing was sent.',
  'wallet-mismatch': 'The wallet that answered is not the account NEXORA has connected, so nothing was sent. Reconnect your Ethereum wallet and try again.',
  'rpc-failure': 'The Sepolia data service could not be reached. Nothing was sent unless your wallet shows otherwise; try again shortly.',
  timeout: 'The request took too long. It may or may not have gone through: check your wallet and the explorer before trying again.',
  'gas-estimation': 'Sepolia rejected this transfer when estimating its fee (for example, the recipient is a contract that refuses ETH). Nothing was sent.',
  'invalid-hash': 'Your wallet returned something that is not a transaction hash, so NEXORA cannot track it. Check your wallet history before trying again.',
  unknown: 'Something went wrong while sending. Check your wallet and the explorer before trying again.',
}

export function describeEthFailure(kind: EthFailureKind): EthFailure { return { kind, message: MESSAGES[kind] } }

/** Typed failure thrown by NEXORA's own transfer code so it passes through classification unchanged. */
export class EthTransferError extends Error {
  kind: EthFailureKind
  constructor(kind: EthFailureKind) { super(kind); this.kind = kind; this.name = 'EthTransferError' }
}

export function classifyEthError(error: unknown): EthFailure {
  if (error instanceof EthTransferError) return describeEthFailure(error.kind)
  const record = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown; name?: unknown; shortMessage?: unknown; cause?: unknown }
  const cause = (typeof record.cause === 'object' && record.cause !== null ? record.cause : {}) as { code?: unknown; message?: unknown; name?: unknown }
  const text = [record.name, record.shortMessage, record.message, cause.name, cause.message].filter((part) => typeof part === 'string').join(' ')
  // EIP-1193 4001 and WalletConnect 5000 are "user rejected".
  if (record.code === 4001 || cause.code === 4001 || record.code === 5000 || cause.code === 5000 || /user rejected|rejected the request|user denied|denied transaction|declin|cancel|UserRejectedRequest/i.test(text)) return describeEthFailure('user-rejected')
  if (/ChainMismatch|chain mismatch|does not match the target chain|wrong network|switch (to|chain)/i.test(text)) return describeEthFailure('network-mismatch')
  if (/insufficient funds|exceeds the balance|InsufficientFunds/i.test(text)) return describeEthFailure('insufficient-funds')
  if (/ConnectorNotConnected|ConnectorAccountNotFound|not connected|no connector|account not found/i.test(text)) return describeEthFailure('wallet-unavailable')
  if (/EstimateGas|execution reverted|intrinsic gas/i.test(text)) return describeEthFailure('gas-estimation')
  if (/timed? ?out|timeout|aborted/i.test(text)) return describeEthFailure('timeout')
  if (/fetch|network request|HttpRequestError|RpcRequestError|rate limit|429/i.test(text)) return describeEthFailure('rpc-failure')
  return describeEthFailure('unknown')
}
