import { Address } from '@ton/core'
import { evaluateTonBalanceGate, TON_TESTNET_CHAIN, type TonBalanceBlockReason } from './chain.ts'
import { formatNanoTon, NANO_PER_TON } from './format.ts'

/**
 * Native TON TESTNET transfer logic. Pure helpers: no React, wallet or browser imports, so everything here is unit-tested.
 * Monetary values are bigint nanoTON; floating point is never used. The wallet stays the final authority on fees,
 * balance and signing: nothing here signs, and no key material is ever read.
 */

/** Conservative per-transfer cap for this testnet-only feature (testnet TON has no market value). */
export const TON_TRANSFER_MAX_NANO = 1_000n * NANO_PER_TON
/** Rough amount kept back for network fees when the balance is known. An estimate, never a guarantee. */
export const TON_TRANSFER_FEE_RESERVE_NANO = 50_000_000n // 0.05 TON
/** Request lifetime in seconds. After this the wallet must refuse to sign it. */
export const TON_TRANSFER_VALIDITY_SECONDS = 300

const AMOUNT_PATTERN = /^(\d{1,10})(?:\.(\d{1,9}))?$/
const MAX_AMOUNT_INPUT_LENGTH = 40

export type TonAmountErrorCode = 'empty' | 'format' | 'decimals' | 'zero' | 'too-large'
export type TonAmountResult = { ok: true; nano: bigint } | { ok: false; code: TonAmountErrorCode; message: string }

/**
 * Parses a human TON amount ("1", "0.5", "12.345678901") into exact nanoTON with string/bigint arithmetic.
 * Outer whitespace is ignored; everything else must be digits with at most one "." and at most 9 decimals.
 * Rejects empty, zero, signs, exponents, separators, a leading/trailing ".", hex and amounts above the cap.
 */
export function parseTonAmount(input: string): TonAmountResult {
  const text = input.trim()
  if (text === '') return { ok: false, code: 'empty', message: 'Enter an amount in TON.' }
  if (text.length > MAX_AMOUNT_INPUT_LENGTH) return { ok: false, code: 'format', message: 'Enter a plain decimal number such as 1.5.' }
  const match = AMOUNT_PATTERN.exec(text)
  if (!match) {
    if (/^\d+\.\d{10,}$/.test(text)) return { ok: false, code: 'decimals', message: 'TON has at most 9 decimal places.' }
    if (/^\d{11,}(?:\.\d*)?$/.test(text)) return { ok: false, code: 'too-large', message: `The testnet limit is ${formatNanoTon(TON_TRANSFER_MAX_NANO, 0)} TON per transfer.` }
    return { ok: false, code: 'format', message: 'Enter a plain decimal number such as 1.5, using “.” as the decimal separator and no signs, spaces, commas or exponents.' }
  }
  const nano = BigInt(match[1]) * NANO_PER_TON + BigInt((match[2] ?? '').padEnd(9, '0') || '0')
  if (nano === 0n) return { ok: false, code: 'zero', message: 'The amount must be greater than zero.' }
  if (nano > TON_TRANSFER_MAX_NANO) return { ok: false, code: 'too-large', message: `The testnet limit is ${formatNanoTon(TON_TRANSFER_MAX_NANO, 0)} TON per transfer.` }
  return { ok: true, nano }
}

export type TonRecipientErrorCode = 'empty' | 'malformed' | 'raw-form' | 'not-testnet' | 'workchain' | 'self'
export type TonRecipientResult = { ok: true; address: string; bounceable: boolean } | { ok: false; code: TonRecipientErrorCode; message: string }

/**
 * Validates a recipient with @ton/core (checksum, tag and length) and returns it in canonical user-friendly,
 * URL-safe form. The address itself is never altered: the bounceable flag the user pasted is kept, and only the
 * base64 alphabet may be normalised. Only test-only addresses (prefix 0Q / kQ) on the basechain are accepted, so a
 * mainnet-style address pasted by mistake is refused instead of being sent to. `ownRawAddress` (the connected
 * account, raw form) is refused as a recipient.
 */
export function validateTonRecipient(input: string, ownRawAddress?: string | null): TonRecipientResult {
  const text = input.trim()
  if (text === '') return { ok: false, code: 'empty', message: 'Enter the recipient’s TON testnet address.' }
  if (/^-?\d+:/.test(text)) return { ok: false, code: 'raw-form', message: 'Use the user-friendly address (starts with 0Q or kQ), not the raw “workchain:hex” form.' }
  if (text.length !== 48 || !Address.isFriendly(text)) return { ok: false, code: 'malformed', message: 'This is not a valid TON address. Check that you copied all 48 characters.' }
  let parsed: ReturnType<typeof Address.parseFriendly>
  try {
    parsed = Address.parseFriendly(text)
  } catch {
    return { ok: false, code: 'malformed', message: 'This is not a valid TON address (the checksum does not match). Check for typos.' }
  }
  if (!parsed.isTestOnly) return { ok: false, code: 'not-testnet', message: 'This looks like a mainnet-style address. Use a testnet address (starts with 0Q or kQ).' }
  if (parsed.address.workChain !== 0) return { ok: false, code: 'workchain', message: 'Only basechain (workchain 0) addresses are supported here.' }
  if (ownRawAddress) {
    let own: Address | null = null
    try { own = Address.parseRaw(ownRawAddress) } catch { own = null }
    if (own && own.equals(parsed.address)) return { ok: false, code: 'self', message: 'This is your own connected address. Enter a different recipient.' }
  }
  return { ok: true, address: parsed.address.toString({ urlSafe: true, bounceable: parsed.isBounceable, testOnly: true }), bounceable: parsed.isBounceable }
}

export type TonTransferBlockReason = TonBalanceBlockReason

export type TonTransferGate = { allowed: true; address: string } | { allowed: false; reason: TonTransferBlockReason; message: string }

const BLOCK_MESSAGE: Record<TonTransferBlockReason, string> = {
  restoring: 'Restoring your TON wallet session…',
  disconnected: 'Connect a TON wallet to send testnet TON.',
  mainnet: 'Your wallet is on TON Mainnet. Sending is disabled. Switch your wallet to TON testnet in its own settings, then disconnect and reconnect.',
  'unknown-network': 'Your wallet did not report TON testnet, so sending is disabled. Switch your wallet to TON testnet in its own settings, then disconnect and reconnect.',
  'invalid-address': 'The wallet reported an account address NEXORA cannot use. Disconnect and reconnect.',
}

/**
 * Whether a send may be offered at all. Reuses the Batch 1 gate, so it passes only for a restored, connected wallet
 * that positively reported the exact testnet chain "-3" with a well-formed address. (The form is mounted only inside
 * the TON Connect provider, which itself is mounted only after the manifest/config checks pass.)
 */
export function evaluateTonTransferGate(input: { restored: boolean; chain: unknown; address: string | null }): TonTransferGate {
  const gate = evaluateTonBalanceGate(input)
  return gate.allowed ? gate : { allowed: false, reason: gate.reason, message: BLOCK_MESSAGE[gate.reason] }
}

/** Returns an error message when the amount is certainly unaffordable for a KNOWN balance, otherwise null. An estimate, not a guarantee. */
export function checkTonAffordability(amountNano: bigint, balanceNano: bigint | null): string | null {
  if (balanceNano === null) return null
  if (amountNano > balanceNano) return `This is more than the ${formatNanoTon(balanceNano)} TON last read for your account.`
  if (amountNano + TON_TRANSFER_FEE_RESERVE_NANO > balanceNano) return `Keep about ${formatNanoTon(TON_TRANSFER_FEE_RESERVE_NANO)} TON free for network fees (balance last read: ${formatNanoTon(balanceNano)} TON). Your wallet makes the final call.`
  return null
}

export interface TonTransferRequest {
  validUntil: number
  network: typeof TON_TESTNET_CHAIN
  messages: [{ address: string; amount: string }]
}

/** The ONLY request shape this feature sends: one plain native transfer, explicitly on testnet, with a short expiry and no payload. */
export function buildTonTransferRequest(recipient: string, amountNano: bigint, nowMs: number): TonTransferRequest {
  if (amountNano <= 0n || amountNano > TON_TRANSFER_MAX_NANO) throw new RangeError('Transfer amount is outside the allowed range.')
  return {
    validUntil: Math.floor(nowMs / 1000) + TON_TRANSFER_VALIDITY_SECONDS,
    network: TON_TESTNET_CHAIN,
    messages: [{ address: recipient, amount: amountNano.toString() }],
  }
}

export type TonTransferFailure = 'rejected' | 'wrong-network' | 'not-connected' | 'unsupported' | 'timeout' | 'error'

/**
 * Maps a TON Connect sendTransaction error to a failure kind. Class names can be mangled by minifiers, so this matches
 * on message text (TON Connect prefixes messages with the class name and a description, e.g. "UserRejectsError: User
 * rejects the action in the wallet."). Raw error text is never shown to the user.
 */
export function classifyTonTransferError(error: unknown): TonTransferFailure {
  const text = error instanceof Error ? `${error.name} ${error.message}` : typeof error === 'string' ? error : ''
  if (/reject|declin|denied|cancel|closed|dismiss/i.test(text)) return 'rejected'
  if (/wrong ?network|network mismatch/i.test(text)) return 'wrong-network'
  if (/not connected|connect wallet/i.test(text)) return 'not-connected'
  if (/support|missing required features/i.test(text)) return 'unsupported'
  if (/timeout|timed out|expired/i.test(text)) return 'timeout'
  return 'error'
}

export const TON_TRANSFER_FAILURE_MESSAGE: Readonly<Record<TonTransferFailure, string>> = {
  rejected: 'The request was cancelled or declined in your wallet. Nothing was sent.',
  'wrong-network': 'Your wallet is not on TON testnet. Nothing was sent. Switch the wallet to testnet in its settings, then disconnect and reconnect.',
  'not-connected': 'Your TON wallet is no longer connected. Reconnect it and try again.',
  unsupported: 'Your wallet does not support this transfer request. Try a different TON wallet.',
  timeout: 'The wallet did not answer in time. Check the wallet app for a pending request before trying again; nothing is confirmed.',
  error: 'The wallet reported an error. Check your wallet app before trying again, since the request may still be pending there.',
}

export type TonTransferOutcome =
  | { status: 'submitted' }
  | { status: 'rejected'; message: string }
  | { status: 'failed'; failure: TonTransferFailure; message: string }

/**
 * Sends one validated request through the supplied TON Connect `send` function and reduces the result to an outcome.
 * "submitted" means only that the wallet accepted the request: the returned BOC is deliberately discarded (it is not a
 * transaction hash) and nothing here claims on-chain confirmation.
 */
export async function submitTonTransfer(send: (request: TonTransferRequest) => Promise<unknown>, request: TonTransferRequest): Promise<TonTransferOutcome> {
  try {
    await send(request)
    return { status: 'submitted' }
  } catch (error) {
    const failure = classifyTonTransferError(error)
    const message = TON_TRANSFER_FAILURE_MESSAGE[failure]
    return failure === 'rejected' ? { status: 'rejected', message } : { status: 'failed', failure, message }
  }
}
