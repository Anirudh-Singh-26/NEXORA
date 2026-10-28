/**
 * Read-only Sepolia access for the ETH send flow: balance, fee estimate and receipt polling, all through a viem public
 * client pinned to Sepolia and the project's configured Sepolia RPC (WALLET_NETWORK_CONFIG). Nothing here can sign or
 * send. Every answer is checked against Sepolia's chain id before it is used.
 */
import { createPublicClient, http, type PublicClient } from 'viem'
import { sepolia } from 'viem/chains'
import { WALLET_NETWORK_CONFIG } from '../wallet/network-config.ts'
import { SEPOLIA_CHAIN_ID } from '../network/testnet.ts'
import { EthTransferError } from './errors.ts'
import { PLAIN_TRANSFER_GAS, type EthChainSnapshot } from './amount.ts'

export const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/

export type ReceiptState = 'pending' | 'success' | 'reverted'

/** Minimal read surface, so tests can inject a fake without a network. */
export interface EthReader {
  getBalance(address: `0x${string}`): Promise<bigint>
  estimateGas(args: { account: `0x${string}`; to: `0x${string}`; value: bigint }): Promise<bigint>
  maxFeePerGas(): Promise<bigint>
  receiptState(hash: `0x${string}`): Promise<ReceiptState>
  chainId(): Promise<number>
}

let shared: PublicClient | null = null
function sepoliaClient(): PublicClient {
  shared ??= createPublicClient({ chain: sepolia, transport: http(WALLET_NETWORK_CONFIG.evm.sepolia.publicRpcUrl, { timeout: 15_000, retryCount: 1 }) }) as PublicClient
  return shared
}

export function createSepoliaReader(client: PublicClient = sepoliaClient()): EthReader {
  return {
    getBalance: (address) => client.getBalance({ address, blockTag: 'latest' }),
    estimateGas: (args) => client.estimateGas(args),
    async maxFeePerGas() {
      try { return (await client.estimateFeesPerGas()).maxFeePerGas } catch {
        return (await client.getGasPrice()) * 2n
      }
    },
    async receiptState(hash) {
      try {
        const receipt = await client.getTransactionReceipt({ hash })
        return receipt.status === 'success' ? 'success' : 'reverted'
      } catch (error) {
        // viem throws TransactionReceiptNotFoundError while the transaction is still pending.
        if (/could not be found|not found|TransactionReceiptNotFound/i.test(`${(error as { name?: string })?.name ?? ''} ${(error as { message?: string })?.message ?? ''}`)) return 'pending'
        throw error
      }
    },
    chainId: () => client.getChainId(),
  }
}

/** Fresh balance + gas + fee ceiling for a transfer. With no recipient yet, the plain-transfer gas floor is used. */
export async function fetchEthSnapshot(reader: EthReader, from: `0x${string}`, to: `0x${string}` | null, wei: bigint): Promise<EthChainSnapshot> {
  let chainId: number
  try { chainId = await reader.chainId() } catch { throw new EthTransferError('rpc-failure') }
  if (chainId !== SEPOLIA_CHAIN_ID) throw new EthTransferError('network-mismatch')
  let balance: bigint
  let maxFeePerGas: bigint
  try { [balance, maxFeePerGas] = await Promise.all([reader.getBalance(from), reader.maxFeePerGas()]) } catch { throw new EthTransferError('rpc-failure') }
  let gas = PLAIN_TRANSFER_GAS
  if (to) {
    try {
      // Estimate with a value the account can actually hold, so an over-balance amount reports as "not enough ETH"
      // (handled by checkEthAffordability) rather than as an estimation failure.
      const estimate = await reader.estimateGas({ account: from, to, value: wei > balance ? 0n : wei })
      gas = estimate > PLAIN_TRANSFER_GAS ? estimate : PLAIN_TRANSFER_GAS
    } catch (error) {
      if (error instanceof EthTransferError) throw error
      throw new EthTransferError(/revert|EstimateGas|intrinsic/i.test(`${(error as { name?: string })?.name ?? ''} ${(error as { message?: string })?.message ?? ''}`) ? 'gas-estimation' : 'rpc-failure')
    }
  }
  return { balance, gas, maxFeePerGas }
}
