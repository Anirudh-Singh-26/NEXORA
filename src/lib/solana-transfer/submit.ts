/**
 * Orchestrates one SOL transfer: re-check the network gate, read fresh chain data from Devnet, re-check affordability
 * against it, have the WALLET build-sign (injected `sign`), then relay the signed transaction to Devnet. Dependencies are
 * injected so every branch is testable without a wallet or a network. Nothing here ever touches a key.
 */
import { checkAffordability } from './amount.ts'
import { classifyTransferError, describeFailure, TransferError, type TransferFailure } from './errors.ts'
import type { PreparedTransfer } from './client.ts'

export interface TransferIntent { from: string; to: string; lamports: bigint }

export interface SubmitDeps {
  /** Null when the transfer may proceed, otherwise why the network gate is closed (re-evaluated right before signing). */
  gateMessage: () => string | null
  prepare: (from: string, to: string) => Promise<PreparedTransfer>
  /** Builds the transfer, has the wallet sign it, and returns the signed transaction as base64. */
  sign: (intent: TransferIntent, prepared: PreparedTransfer) => Promise<string>
  relay: (signedBase64: string) => Promise<string>
}

export type SubmitOutcome =
  | { status: 'submitted'; signature: string; lastValidBlockHeight: number; fee: bigint }
  /** Stopped before the wallet was asked, with a specific reason (network, funds, rent). Nothing was sent. */
  | { status: 'blocked'; message: string }
  | { status: 'failed'; failure: TransferFailure; /** True when the wallet may already have signed (relay stage), so the user should check the explorer. */ afterSigning: boolean }

export async function submitSolTransfer(deps: SubmitDeps, intent: TransferIntent): Promise<SubmitOutcome> {
  const gate = deps.gateMessage()
  if (gate !== null) return { status: 'blocked', message: gate }
  let prepared: PreparedTransfer
  try { prepared = await deps.prepare(intent.from, intent.to) } catch (error) { return { status: 'failed', failure: classifyTransferError(error), afterSigning: false } }
  const unaffordable = checkAffordability(intent.lamports, { balance: prepared.balance, fee: prepared.fee, rentExemptMinimum: prepared.rentExemptMinimum, recipientBalance: prepared.recipientBalance })
  if (unaffordable !== null) return { status: 'blocked', message: unaffordable }
  // The network may have changed while the fresh data was loading: ask the gate once more, immediately before the wallet.
  const lateGate = deps.gateMessage()
  if (lateGate !== null) return { status: 'blocked', message: lateGate }

  let signed: string
  try { signed = await deps.sign(intent, prepared) } catch (error) { return { status: 'failed', failure: classifyTransferError(error), afterSigning: false } }
  try {
    const signature = await deps.relay(signed)
    return { status: 'submitted', signature, lastValidBlockHeight: prepared.lastValidBlockHeight, fee: prepared.fee }
  } catch (error) {
    // The wallet already signed: a timeout here may still have reached the network, so the caller must say so.
    const failure = error instanceof TransferError ? describeFailure(error.kind) : classifyTransferError(error)
    return { status: 'failed', failure, afterSigning: true }
  }
}
