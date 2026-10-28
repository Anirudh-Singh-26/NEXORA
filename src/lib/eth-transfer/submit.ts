/**
 * Orchestrates one ETH transfer: re-check the network gate, read fresh Sepolia data, re-check affordability, ask the
 * WALLET to sign and submit (injected `send`), and validate the hash it returns. Dependencies are injected so every
 * branch is testable without a wallet or a network. Nothing here ever touches a key.
 */
import { checkEthAffordability, maxFee, type EthChainSnapshot } from './amount.ts'
import { classifyEthError, EthTransferError, type EthFailure } from './errors.ts'
import { TX_HASH_PATTERN } from './client.ts'

export interface EthTransferIntent { from: `0x${string}`; to: `0x${string}`; wei: bigint }

export interface EthSubmitDeps {
  /** Null when the transfer may proceed, otherwise why the network gate is closed (re-evaluated right before signing). */
  gateMessage: () => string | null
  snapshot: (intent: EthTransferIntent) => Promise<EthChainSnapshot>
  /** Has the connected wallet sign and submit the transaction; resolves with the transaction hash. */
  send: (intent: EthTransferIntent) => Promise<string>
}

export type EthSubmitOutcome =
  | { status: 'submitted'; hash: `0x${string}`; maxFeeWei: bigint }
  /** Stopped before the wallet was asked, with a specific reason (network, funds). Nothing was sent. */
  | { status: 'blocked'; message: string }
  | { status: 'failed'; failure: EthFailure; /** True when the wallet may already have broadcast it, so the user should check the explorer. */ possiblySent: boolean }

export async function submitEthTransfer(deps: EthSubmitDeps, intent: EthTransferIntent): Promise<EthSubmitOutcome> {
  const gate = deps.gateMessage()
  if (gate !== null) return { status: 'blocked', message: gate }
  let snapshot: EthChainSnapshot
  try { snapshot = await deps.snapshot(intent) } catch (error) { return { status: 'failed', failure: classifyEthError(error), possiblySent: false } }
  const unaffordable = checkEthAffordability(intent.wei, snapshot)
  if (unaffordable !== null) return { status: 'blocked', message: unaffordable }
  // The network may have changed while the fresh data was loading: ask the gate once more, immediately before the wallet.
  const lateGate = deps.gateMessage()
  if (lateGate !== null) return { status: 'blocked', message: lateGate }

  let hash: string
  try { hash = await deps.send(intent) } catch (error) {
    const failure = classifyEthError(error)
    // A timeout may still have reached the network; every other wallet-side failure means nothing was broadcast.
    return { status: 'failed', failure, possiblySent: failure.kind === 'timeout' || failure.kind === 'unknown' }
  }
  if (typeof hash !== 'string' || !TX_HASH_PATTERN.test(hash)) return { status: 'failed', failure: classifyEthError(new EthTransferError('invalid-hash')), possiblySent: true }
  return { status: 'submitted', hash: hash as `0x${string}`, maxFeeWei: maxFee(snapshot) }
}
