/**
 * The single gate every ETH transfer passes before NEXORA asks a wallet to sign anything. It combines NEXORA's EVM
 * network verifier (the chain the wallet reports right now) with the project-wide Sepolia guard in lib/network/testnet.ts,
 * so Mainnet, other EVM chains and unreported networks are all refused.
 */
import { verifyEvmNetwork } from '../network/environments.ts'
import { guardEvmTransaction } from '../network/testnet.ts'

export type EthSendGate = { allowed: true; address: `0x${string}`; chainId: number } | { allowed: false; message: string }

export interface EthSendGateInput {
  /** The connected EVM account, or null when none is connected. */
  address: string | null
  /** The chain the wallet reports, or null when unreported. */
  chainId: number | null
  /** True while a previously connected session is still being restored. */
  restoring?: boolean
}

export function evaluateEthSendGate(input: EthSendGateInput): EthSendGate {
  if (input.restoring) return { allowed: false, message: 'Restoring your Ethereum wallet session…' }
  if (!input.address || !/^0x[0-9a-fA-F]{40}$/.test(input.address)) return { allowed: false, message: 'Connect an Ethereum wallet to send ETH.' }
  const verification = verifyEvmNetwork(input.chainId)
  const guard = guardEvmTransaction(input.chainId)
  if (!guard.ok || input.chainId === null) return { allowed: false, message: verification.message ?? (guard.ok ? 'Your wallet did not report its network.' : guard.reason) }
  return { allowed: true, address: input.address as `0x${string}`, chainId: input.chainId }
}
