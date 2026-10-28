/**
 * The single gate every SOL transfer passes before NEXORA builds or asks a wallet to sign anything. It combines
 * NEXORA's network verifier (what the connected Solana account reports) with the project-wide Devnet transaction guard
 * in lib/network/testnet.ts, so Mainnet, Testnet, unknown and unreported networks are all refused.
 */
import { verifySolanaNetwork } from '../network/environments.ts'
import { guardSolanaTransaction, SOLANA_CLUSTER } from '../network/testnet.ts'

export type SendGate = { allowed: true; address: string } | { allowed: false; message: string }

export interface SendGateInput {
  /** The connected Solana account, or null when none is connected. */
  address: string | null
  /** The cluster name the wallet connection reports (e.g. "Solana Devnet", "Solana"), or null when unreported. */
  networkName: string | null
  /** True while a previously connected session is still being restored. */
  restoring?: boolean
}

export function evaluateSolSendGate(input: SendGateInput): SendGate {
  if (input.restoring) return { allowed: false, message: 'Restoring your Solana wallet session…' }
  if (!input.address) return { allowed: false, message: 'Connect a Solana wallet to send SOL.' }
  const verification = verifySolanaNetwork(input.networkName)
  // Only a positively verified Devnet session reaches the guard as 'devnet'; anything else is passed through as reported.
  const guard = guardSolanaTransaction(verification.status === 'verified' ? SOLANA_CLUSTER : (input.networkName ?? null))
  if (!guard.ok) return { allowed: false, message: verification.message ?? guard.reason }
  return { allowed: true, address: input.address }
}
