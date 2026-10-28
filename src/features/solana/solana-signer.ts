import { TransferError } from '@/lib/solana-transfer/errors'
import { bytesToBase64, type SignTransaction } from '@/lib/solana-transfer/provider'
import type { PreparedTransfer } from '@/lib/solana-transfer/client'
import type { TransferIntent } from '@/lib/solana-transfer/submit'

/**
 * Builds the legacy System Program transfer, asks the WALLET to sign it, and returns the signed transaction as base64.
 * `@solana/web3.js` (1.98.x, already in the lockfile through Reown's Solana adapter) is loaded on demand so it stays out of
 * the initial bundle. The transaction uses the Devnet blockhash NEXORA just read from the Devnet proxy, so it can only be
 * valid on Devnet. After the wallet returns, the signed transaction is inspected: it must still contain exactly one
 * System transfer of the reviewed amount from the connected account to the reviewed recipient, with the same blockhash.
 * A wallet that returns anything else is rejected, so the relayed bytes always match what the user reviewed.
 */
export async function signSolTransfer(sign: SignTransaction, intent: TransferIntent, prepared: PreparedTransfer): Promise<string> {
  const { PublicKey, SystemProgram, SystemInstruction, Transaction } = await import('@solana/web3.js')
  const from = new PublicKey(intent.from)
  const to = new PublicKey(intent.to)
  const transaction = new Transaction({ feePayer: from, blockhash: prepared.blockhash, lastValidBlockHeight: prepared.lastValidBlockHeight })
    .add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: intent.lamports }))

  const returned = await sign(transaction)
  // Different wallet adapters may hand back a Transaction from their own copy of web3.js, so re-parse the wire bytes
  // into this module's class before checking anything. serialize() itself throws when a required signature is missing.
  if (typeof returned !== 'object' || returned === null || typeof (returned as { serialize?: unknown }).serialize !== 'function') throw new TransferError('wallet-unsupported')
  let signed: InstanceType<typeof Transaction>
  try { signed = Transaction.from((returned as { serialize: () => Uint8Array }).serialize()) } catch { throw new TransferError('invalid-signature') }
  if (signed.recentBlockhash !== prepared.blockhash || !signed.feePayer?.equals(from)) throw new TransferError('wallet-mismatch')
  const transfers = signed.instructions.filter((instruction) => instruction.programId.equals(SystemProgram.programId) && SystemInstruction.decodeInstructionType(instruction) === 'Transfer')
  if (transfers.length !== 1) throw new TransferError('wallet-mismatch')
  const decoded = SystemInstruction.decodeTransfer(transfers[0])
  if (!decoded.fromPubkey.equals(from) || !decoded.toPubkey.equals(to) || BigInt(decoded.lamports) !== intent.lamports) throw new TransferError('wallet-mismatch')
  if (!signed.signature || !signed.verifySignatures()) throw new TransferError('invalid-signature')
  return bytesToBase64(signed.serialize())
}
