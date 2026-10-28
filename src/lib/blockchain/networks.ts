import { WALLET_NETWORK_CONFIG } from '../wallet/network-config.ts'
import type { ChainConfig, ChainId, RpcEndpoint } from './types.ts'

/**
 * Public, key-free endpoints. Availability and CORS behaviour of public RPCs can change without notice;
 * every response is checked against the requested chain ID before it is used.
 * Chain IDs: Ethereum 1, Base 8453, Arbitrum One 42161, Linea 59144.
 */
interface ChainSeed extends Omit<ChainConfig, 'endpoints'> {
  publicEndpoints: Array<{ id: string; url: string }>
}

const EVM = WALLET_NETWORK_CONFIG.evm
const SEEDS: ChainSeed[] = [
  { chainId: EVM.ethereum.chainId, name: EVM.ethereum.name, shortName: EVM.ethereum.shortName, nativeSymbol: EVM.ethereum.nativeCurrency.symbol, nativeDecimals: EVM.ethereum.nativeCurrency.decimals, explorerUrl: EVM.ethereum.explorerUrl, core: true, publicEndpoints: EVM.ethereum.publicRpcUrls.map((url, i) => ({ id: i === 0 ? 'publicnode-ethereum' : 'drpc-ethereum', url })) },
  { chainId: EVM.base.chainId, name: EVM.base.name, shortName: EVM.base.shortName, nativeSymbol: EVM.base.nativeCurrency.symbol, nativeDecimals: EVM.base.nativeCurrency.decimals, explorerUrl: EVM.base.explorerUrl, core: true, publicEndpoints: EVM.base.publicRpcUrls.map((url, i) => ({ id: i === 0 ? 'base-official' : 'publicnode-base', url })) },
  { chainId: EVM.arbitrum.chainId, name: EVM.arbitrum.name, shortName: EVM.arbitrum.shortName, nativeSymbol: EVM.arbitrum.nativeCurrency.symbol, nativeDecimals: EVM.arbitrum.nativeCurrency.decimals, explorerUrl: EVM.arbitrum.explorerUrl, core: true, publicEndpoints: EVM.arbitrum.publicRpcUrls.map((url, i) => ({ id: i === 0 ? 'arbitrum-official' : 'publicnode-arbitrum', url })) },
  { chainId: EVM.linea.chainId, name: EVM.linea.name, shortName: EVM.linea.shortName, nativeSymbol: EVM.linea.nativeCurrency.symbol, nativeDecimals: EVM.linea.nativeCurrency.decimals, explorerUrl: EVM.linea.explorerUrl, core: true, publicEndpoints: EVM.linea.publicRpcUrls.map((url, i) => ({ id: i === 0 ? 'linea-official' : 'publicnode-linea', url })) },
  // These EVM networks remain in the general blockchain data layer for existing non-wallet-page features.
  { chainId: EVM.polygon.chainId, name: EVM.polygon.name, shortName: EVM.polygon.shortName, nativeSymbol: EVM.polygon.nativeCurrency.symbol, nativeDecimals: EVM.polygon.nativeCurrency.decimals, explorerUrl: EVM.polygon.explorerUrl, core: false, publicEndpoints: EVM.polygon.publicRpcUrls.map((url) => ({ id: 'publicnode-polygon', url })) },
  { chainId: EVM.optimism.chainId, name: EVM.optimism.name, shortName: EVM.optimism.shortName, nativeSymbol: EVM.optimism.nativeCurrency.symbol, nativeDecimals: EVM.optimism.nativeCurrency.decimals, explorerUrl: EVM.optimism.explorerUrl, core: false, publicEndpoints: EVM.optimism.publicRpcUrls.map((url) => ({ id: 'optimism-official', url })) },
  { chainId: EVM.sepolia.chainId, name: EVM.sepolia.name, shortName: EVM.sepolia.shortName, nativeSymbol: EVM.sepolia.nativeCurrency.symbol, nativeDecimals: EVM.sepolia.nativeCurrency.decimals, explorerUrl: EVM.sepolia.explorerUrl, core: false, publicEndpoints: [{ id: 'publicnode-sepolia', url: EVM.sepolia.publicRpcUrl }] },
]

export type EnvSource = Record<string, string | undefined>

/** Env var name for an optional preferred RPC URL for a chain, e.g. VITE_RPC_URL_8453. */
export function rpcEnvKey(chainId: ChainId): string {
  return `VITE_RPC_URL_${chainId}`
}

/**
 * Accepts only https URLs (http only for localhost development), without embedded credentials.
 * The value comes from build-time configuration, never from user input.
 */
export function parseConfiguredRpcUrl(raw: string | undefined): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value) return null
  let url: URL
  try { url = new URL(value) } catch { return null }
  if (url.username || url.password) return null
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null
  return url.toString()
}

export function buildChains(env: EnvSource = {}): ChainConfig[] {
  return SEEDS.map(({ publicEndpoints, ...seed }) => {
    const endpoints: RpcEndpoint[] = []
    const configured = parseConfiguredRpcUrl(env[rpcEnvKey(seed.chainId)])
    if (configured) endpoints.push({ id: 'configured-rpc', url: configured, kind: 'configured' })
    for (const item of publicEndpoints) {
      if (item.url !== configured) endpoints.push({ id: item.id, url: item.url, kind: 'public' })
    }
    return { ...seed, endpoints }
  })
}

/** Normalises a chain ID from a number, a 0x hex string (as wallets report it) or a decimal string. */
export function parseChainId(input: unknown): ChainId | null {
  let value: number
  if (typeof input === 'number') value = input
  else if (typeof input === 'string' && /^0x[0-9a-fA-F]+$/.test(input.trim())) value = Number.parseInt(input.trim(), 16)
  else if (typeof input === 'string' && /^[0-9]+$/.test(input.trim())) value = Number.parseInt(input.trim(), 10)
  else return null
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export function resolveChain(chains: readonly ChainConfig[], input: unknown): ChainConfig | null {
  const id = parseChainId(input)
  return id === null ? null : chains.find((chain) => chain.chainId === id) ?? null
}
