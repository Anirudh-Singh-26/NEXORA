/**
 * Maps whatever a wallet provider or NEXORA's transfer client throws to one of a fixed set of outcomes with a plain
 * message. Matches on message text and numeric codes only (class names get mangled by minifiers) and never echoes raw
 * internals, URLs or provider text.
 */
export type TransferFailureKind =
  | 'user-rejected' | 'insufficient-funds' | 'insufficient-rent' | 'network-mismatch' | 'blockhash-expired'
  | 'wallet-unsupported' | 'wallet-mismatch' | 'rpc-failure' | 'rate-limited' | 'timeout' | 'invalid-signature' | 'rejected' | 'unknown'

export interface TransferFailure { kind: TransferFailureKind; message: string }

const MESSAGES: Record<TransferFailureKind, string> = {
  'user-rejected': 'You declined the request in your wallet. Nothing was sent.',
  'insufficient-funds': 'Not enough SOL on Devnet to cover the amount and the network fee. Nothing was sent.',
  'insufficient-rent': 'The transfer would leave an account below the minimum balance Solana requires. Try a different amount. Nothing was sent.',
  'network-mismatch': 'Your wallet is not on Solana Devnet, so NEXORA stopped. Switch the wallet to Devnet, reconnect, and try again. Nothing was sent.',
  'blockhash-expired': 'The transaction took too long to approve and expired. Nothing was sent; review the transfer and try again.',
  'wallet-unsupported': 'This wallet does not support signing transactions from NEXORA. Use Phantom, or another wallet that can sign Solana transactions.',
  'wallet-mismatch': 'The wallet that answered is not the account NEXORA has connected, so nothing was sent. Reconnect your Solana wallet and try again.',
  'rpc-failure': 'The Devnet data service could not be reached. Nothing was sent unless your wallet shows otherwise; try again shortly.',
  'rate-limited': 'The Devnet data service is rate limiting requests. Wait a moment and try again.',
  timeout: 'The request took too long. It may or may not have gone through: check the explorer before trying again.',
  'invalid-signature': 'The signed transaction was not accepted as valid. Nothing was sent; try again.',
  rejected: 'The Solana network refused the transaction. Nothing was sent.',
  unknown: 'Something went wrong while sending. Check your wallet and the explorer before trying again.',
}

export function describeFailure(kind: TransferFailureKind): TransferFailure { return { kind, message: MESSAGES[kind] } }

/** Typed failure thrown by NEXORA's own transfer code so it passes through classification unchanged. */
export class TransferError extends Error {
  kind: TransferFailureKind
  constructor(kind: TransferFailureKind) { super(kind); this.kind = kind; this.name = 'TransferError' }
}

export function classifyTransferError(error: unknown): TransferFailure {
  if (error instanceof TransferError) return describeFailure(error.kind)
  const record = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown; name?: unknown }
  const text = `${typeof record.name === 'string' ? record.name : ''} ${typeof record.message === 'string' ? record.message : typeof error === 'string' ? error : ''}`
  // EIP-1193 4001 and WalletConnect 5000/5001 are "user rejected".
  if (record.code === 4001 || record.code === 5000 || /reject|declin|denied|cancel|user closed|not approved/i.test(text)) return describeFailure('user-rejected')
  if (/timed? ?out|timeout|aborted/i.test(text)) return describeFailure('timeout')
  if (/not supported|unsupported|not implemented|method not found|does not support/i.test(text)) return describeFailure('wallet-unsupported')
  if (/insufficient (funds|lamports)/i.test(text)) return describeFailure('insufficient-funds')
  if (/blockhash/i.test(text)) return describeFailure('blockhash-expired')
  return describeFailure('unknown')
}
