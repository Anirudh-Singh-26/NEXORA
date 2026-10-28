/**
 * Pure validation and arithmetic for a native ETH transfer on Sepolia. All money is bigint wei (1 ETH = 10^18 wei);
 * floating point is never used. No React, no I/O.
 */
import { getAddress, isAddress } from 'viem'

export const WEI_PER_ETH = 1_000_000_000_000_000_000n
/** Gas of a plain ETH transfer to an EOA. Used only as a floor/fallback; the real estimate comes from the RPC. */
export const PLAIN_TRANSFER_GAS = 21_000n
/** Hard ceiling for one NEXORA transfer: a Sepolia-sized safety net. */
export const ETH_TRANSFER_MAX_WEI = 1_000_000n * WEI_PER_ETH
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export type EthAmountResult = { ok: true; wei: bigint } | { ok: false; message: string }

/** Parses what the user typed ("0.05", "1", ".25") into wei. Positive, at most 18 decimals, no signs or exponents. */
export function parseEthAmount(text: string): EthAmountResult {
  const value = text.trim()
  if (value === '') return { ok: false, message: 'Enter an amount in ETH.' }
  if (value.startsWith('-')) return { ok: false, message: 'The amount must be greater than zero.' }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(value)) return { ok: false, message: 'Use digits and one decimal point only, for example 0.05.' }
  const [whole, fraction = ''] = value.split('.')
  if (fraction.length > 18) return { ok: false, message: 'ETH has at most 18 decimal places.' }
  const wei = BigInt(whole === '' ? '0' : whole) * WEI_PER_ETH + BigInt(fraction.padEnd(18, '0') || '0')
  if (wei <= 0n) return { ok: false, message: 'The amount must be greater than zero.' }
  if (wei > ETH_TRANSFER_MAX_WEI) return { ok: false, message: 'That amount is above what NEXORA will send in one transfer.' }
  return { ok: true, wei }
}

/** Exact decimal string of a wei amount, trailing zeros trimmed ("1.5", "0.000000000000000001"). */
export function formatEth(wei: bigint): string {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const whole = abs / WEI_PER_ETH
  const fraction = (abs % WEI_PER_ETH).toString().padStart(18, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

export type EthRecipientResult = { ok: true; address: `0x${string}` } | { ok: false; message: string }

/** Validates a recipient: a real 20-byte address (checksum enforced when mixed-case), not the sender, not the zero address. */
export function validateEthRecipient(text: string, ownAddress: string | null): EthRecipientResult {
  const value = text.trim()
  if (value === '') return { ok: false, message: 'Enter a recipient address.' }
  if (!/^0x/i.test(value) && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return { ok: false, message: 'That looks like a Solana address. Enter an Ethereum address (0x…).' }
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) return { ok: false, message: 'That is not a valid Ethereum address (0x followed by 40 hex characters).' }
  const mixed = /[a-f]/.test(value.slice(2)) && /[A-F]/.test(value.slice(2))
  if (mixed && !isAddress(value, { strict: true })) return { ok: false, message: 'The address checksum is wrong. Check for typos or copy it again.' }
  const address = getAddress(value.toLowerCase())
  if (address.toLowerCase() === ZERO_ADDRESS) return { ok: false, message: 'That is the zero address; ETH sent there is burned and cannot be recovered.' }
  if (ownAddress && address.toLowerCase() === ownAddress.toLowerCase()) return { ok: false, message: 'That is your own address. Enter a different recipient.' }
  return { ok: true, address }
}

/** What the chain said right before a send. Every number is wei. */
export interface EthChainSnapshot {
  balance: bigint
  /** Gas units the RPC estimated for this exact transfer (or the plain-transfer floor before a recipient is known). */
  gas: bigint
  /** Upper bound per gas unit (EIP-1559 maxFeePerGas, or gasPrice on a legacy chain). */
  maxFeePerGas: bigint
}

/** Worst-case network fee: gas × maxFeePerGas. The wallet may charge less. */
export function maxFee(snapshot: Pick<EthChainSnapshot, 'gas' | 'maxFeePerGas'>): bigint {
  return snapshot.gas * snapshot.maxFeePerGas
}

/** The most that can be sent while still covering the worst-case fee, never negative. */
export function maxSendable(snapshot: EthChainSnapshot | null): bigint | null {
  if (!snapshot) return null
  const fee = maxFee(snapshot)
  return snapshot.balance > fee ? snapshot.balance - fee : 0n
}

/** Null when the transfer can be afforded, otherwise a plain-language reason. */
export function checkEthAffordability(wei: bigint, snapshot: EthChainSnapshot | null): string | null {
  if (!snapshot) return 'Your balance has not loaded yet, so the amount cannot be checked.'
  const fee = maxFee(snapshot)
  if (wei + fee > snapshot.balance) {
    return `Not enough Sepolia ETH. This transfer needs up to ${formatEth(wei + fee)} ETH (amount plus up to ${formatEth(fee)} ETH network fee) and you have ${formatEth(snapshot.balance)} ETH.`
  }
  return null
}
