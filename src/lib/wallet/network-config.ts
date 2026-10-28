/**
 * Canonical network configuration for NEXORA wallet/data integrations.
 * Public URLs and identifiers only: never put provider API keys or other secrets here.
 * Capability-specific allow-lists remain in their respective modules, but derive their shared
 * chain IDs, names, explorer origins and provider slugs from this registry where applicable.
 */
export const WALLET_NETWORK_CONFIG = {
  evm: {
    sepolia: {
      chainId: 11155111,
      name: 'Sepolia Testnet',
      shortName: 'Sepolia',
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
      explorerUrl: 'https://sepolia.etherscan.io',
      publicRpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
      alchemySlug: 'eth-sepolia',
    },
    ethereum: { chainId: 1, name: 'Ethereum Mainnet', shortName: 'Ethereum', nativeCurrency: { symbol: 'ETH', decimals: 18 }, explorerUrl: 'https://etherscan.io', publicRpcUrls: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'], alchemySlug: 'eth-mainnet', nftSlug: 'eth-mainnet', openSeaSlug: 'ethereum' },
    base: { chainId: 8453, name: 'Base', shortName: 'Base', nativeCurrency: { symbol: 'ETH', decimals: 18 }, explorerUrl: 'https://basescan.org', publicRpcUrls: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'], alchemySlug: 'base-mainnet', nftSlug: 'base-mainnet', openSeaSlug: 'base' },
    arbitrum: { chainId: 42161, name: 'Arbitrum One', shortName: 'Arbitrum', nativeCurrency: { symbol: 'ETH', decimals: 18 }, explorerUrl: 'https://arbiscan.io', publicRpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com'], alchemySlug: 'arb-mainnet', nftSlug: 'arb-mainnet', openSeaSlug: 'arbitrum' },
    linea: { chainId: 59144, name: 'Linea', shortName: 'Linea', nativeCurrency: { symbol: 'ETH', decimals: 18 }, explorerUrl: 'https://lineascan.build', publicRpcUrls: ['https://rpc.linea.build', 'https://linea-rpc.publicnode.com'], alchemySlug: 'linea-mainnet' },
    polygon: { chainId: 137, name: 'Polygon PoS', shortName: 'Polygon', nativeCurrency: { symbol: 'POL', decimals: 18 }, explorerUrl: 'https://polygonscan.com', publicRpcUrls: ['https://polygon-bor-rpc.publicnode.com'], alchemySlug: 'polygon-mainnet', nftSlug: 'polygon-mainnet', openSeaSlug: 'matic' },
    optimism: { chainId: 10, name: 'Optimism', shortName: 'Optimism', nativeCurrency: { symbol: 'ETH', decimals: 18 }, explorerUrl: 'https://optimistic.etherscan.io', publicRpcUrls: ['https://mainnet.optimism.io'], alchemySlug: 'opt-mainnet', nftSlug: 'opt-mainnet', openSeaSlug: 'optimism' },
  },
  solana: {
    devnet: {
      networkId: 'devnet',
      name: 'Solana Devnet',
      genesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
      explorerUrl: 'https://explorer.solana.com',
      publicRpcUrl: 'https://api.devnet.solana.com',
      alchemyHost: 'https://solana-devnet.g.alchemy.com/v2',
      faucetHint: 'Devnet SOL is a free test token with no monetary value.',
    },
  },
  ton: {
    testnet: { chainId: '-3', name: 'TON Testnet', nativeCurrency: { symbol: 'TON' }, explorerUrl: 'https://testnet.tonscan.org', transactionExplorerUrl: 'https://testnet.tonviewer.com', apiBaseUrl: 'https://testnet.toncenter.com/api/v2' },
  },
  tron: {
    shasta: { chainId: '0x94a9059e', name: 'TRON Shasta Testnet', explorerUrl: 'https://shasta.tronscan.org', apiBaseUrl: 'https://api.shasta.trongrid.io' },
    mainnet: { chainId: '0x2b6653dc', name: 'TRON Mainnet' },
    nile: { chainId: '0xcd8690dc', name: 'TRON Nile Testnet' },
  },
  providers: {
    openSeaApiBaseUrl: 'https://api.opensea.io/api/v2',
    openSeaWebUrl: 'https://opensea.io',
    alchemyRpcHostSuffix: '.g.alchemy.com/v2',
    alchemyNftHostSuffix: '.g.alchemy.com/nft/v3',
    alchemyTokenHostSuffix: '.g.alchemy.com/v2',
  },
} as const

export const WALLET_TESTNETS = {
  evm: WALLET_NETWORK_CONFIG.evm.sepolia,
  solana: WALLET_NETWORK_CONFIG.solana.devnet,
  ton: WALLET_NETWORK_CONFIG.ton.testnet,
  tron: WALLET_NETWORK_CONFIG.tron.shasta,
} as const
