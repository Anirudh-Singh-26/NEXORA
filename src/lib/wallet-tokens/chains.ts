import { WALLET_NETWORK_CONFIG } from '../wallet/network-config.ts'

/**
 * Chains for which the wallet-token proxy will query Alchemy's Token API, keyed by EVM chain ID.
 * Values are Alchemy's endpoint slugs (https://<slug>.g.alchemy.com/v2/<key>); they appear in Alchemy's public
 * "supported chains" documentation. Shared by the server proxy (api/wallet-tokens.ts) and the browser client.
 * Whether a given chain's Token API is enabled can depend on the Alchemy plan: the proxy reports that case explicitly.
 */
export const ALCHEMY_NETWORKS: Readonly<Record<number, string>> = Object.fromEntries(
  Object.values(WALLET_NETWORK_CONFIG.evm).filter((network) => 'alchemySlug' in network).map((network) => [network.chainId, network.alchemySlug]),
) as Record<number, string>

export function isWalletTokenChain(chainId: unknown): chainId is number {
  return typeof chainId === 'number' && Number.isSafeInteger(chainId) && Object.prototype.hasOwnProperty.call(ALCHEMY_NETWORKS, chainId)
}
