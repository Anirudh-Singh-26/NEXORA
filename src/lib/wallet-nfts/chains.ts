import { WALLET_NETWORK_CONFIG } from '../wallet/network-config.ts'

/**
 * EVM chains for which NEXORA asks Alchemy's NFT API (v3 getNFTsForOwner) for a wallet's NFTs, keyed by chain ID.
 * Only chains that Alchemy's NFT API documentation names are listed (Ethereum, Polygon, Arbitrum, Optimism, Base).
 * Linea and Sepolia are supported by NEXORA's token/balance layer but are NOT listed here because the NFT API's
 * support for them was not confirmed; they are shown as "not supported by the NFT provider" instead of being guessed.
 * Extending this table is the only change needed once support is confirmed. Shared by the server proxy and the browser.
 */
export interface NftChain {
  /** Alchemy endpoint slug: https://<slug>.g.alchemy.com/nft/v3/<key>/… */
  alchemy: string
  /** OpenSea chain slug used in https://opensea.io/assets/<slug>/<contract>/<tokenId>. */
  opensea: string
}

export const NFT_CHAINS: Readonly<Record<number, NftChain>> = Object.fromEntries(
  Object.values(WALLET_NETWORK_CONFIG.evm)
    .filter((network) => 'nftSlug' in network && 'openSeaSlug' in network)
    .map((network) => [network.chainId, { alchemy: network.nftSlug, opensea: network.openSeaSlug }]),
) as Record<number, NftChain>

export function isNftChain(chainId: unknown): chainId is number {
  return typeof chainId === 'number' && Number.isSafeInteger(chainId) && Object.prototype.hasOwnProperty.call(NFT_CHAINS, chainId)
}

export function openSeaAssetUrl(chainId: number, contract: string, tokenId: string): string | null {
  return isNftChain(chainId) ? `${WALLET_NETWORK_CONFIG.providers.openSeaWebUrl}/assets/${NFT_CHAINS[chainId].opensea}/${contract}/${tokenId}` : null
}
