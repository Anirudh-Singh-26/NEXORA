import type {
  Campaign,
  Catalog,
  Collection,
  CollectionCategory,
  Network,
  NetworkId,
  NftItem,
  Project,
  Token,
} from '@/data/types'
import { artworkAssets } from '@/data/artwork-assets'

function spark(seed: number, points = 28): number[] {
  const values: number[] = []
  let current = 48 + (seed % 12)
  for (let i = 0; i < points; i += 1) {
    const wave = Math.sin((i + seed) * 0.45) * 4.2
    const drift = Math.cos((i + seed) * 0.17) * 2.4
    current = Math.max(12, current + wave * 0.35 + drift * 0.2)
    values.push(Number(current.toFixed(2)))
  }
  return values
}

// Canonical local artwork paths only. The catalog never depends on remote image URLs.
const collectionArtwork: Record<string, string> = {
  'lumen-relics': '/images/nexora/imported/pink-neural-sculpture.jpg',
  'obsidian-choir': '/images/nexora/imported/black-orbit-figure.jpg',
  'drift-avatars': '/images/nexora/imported/blue-haired-cyberpunk-portrait.jpg',
  'paper-moons': '/images/nexora/imported/pastel-cat-avatar.jpg',
  'night-market': '/artwork/night-market.svg',
  'aether-frames': '/images/nexora/imported/glitch-fusion-portrait.jpg',
  'copper-signal': '/images/nexora/imported/ai-network-orb-illustration.jpg',
  'glasswardens': '/images/nexora/imported/storm-eye-crystal-orb.jpg',
  'tideform': '/artwork/tideform.svg',
  'nadir-studio': '/images/nexora/imported/cosmic-girl-avatar.jpg',
  'ember-archive': '/images/nexora/imported/magnetar-mech-core.jpg',
  'neon-circuit': '/images/nexora/imported/neon-headset-avatar.jpg',
  'prism-archives': '/images/nexora/imported/iridescent-sculpted-face.jpg',
  'relic-engines': '/images/nexora/imported/iridescent-sculpted-face.jpg',
}
const collectionBanners: Record<string, string> = {
  'lumen-relics': '/images/nexora/imported/purple-fluid-abstract-banner.jpg',
  'obsidian-choir': '/images/nexora/imported/dark-red-abstract-banner.jpg',
  'drift-avatars': '/images/nexora/imported/violet-neon-abstract-banner.jpg',
  'paper-moons': '/images/nexora/imported/violet-glass-wave-banner.jpg',
  'night-market': '/images/nexora/imported/neon-purple-racing-banner.jpg',
  'aether-frames': '/images/nexora/imported/violet-cosmic-ring-banner.jpg',
  'copper-signal': '/images/nexora/imported/glowing-amber-violet-swirl-banner.jpg',
  'glasswardens': '/images/nexora/imported/violet-gaming-neon-banner.jpg',
  'tideform': '/artwork/tideform-banner.svg',
  'nadir-studio': '/images/nexora/imported/red-gold-fractal-banner.jpg',
  'ember-archive': '/images/nexora/imported/purple-light-tunnel-banner.jpg',
  'neon-circuit': '/images/nexora/imported/neon-purple-racing-banner.jpg',
  'prism-archives': '/images/nexora/imported/monochrome-violet-wave-banner.jpg',
  'relic-engines': '/images/nexora/imported/purple-light-tunnel-banner.jpg',
}
const artworkFor = (key: string) => {
  const isBanner = key.endsWith('-banner')
  const collectionId = key.replace(/-banner$/, '')
  return (isBanner ? collectionBanners[collectionId] : collectionArtwork[collectionId]) ?? collectionArtwork['lumen-relics']
}
const collectionArtworkFallback: Record<string, string> = {
  'lumen-relics': '/images/nexora/white-anime-figure.jpg',
  'obsidian-choir': '/images/nexora/black-masked-streetwear-avatar.jpg',
  'drift-avatars': '/images/nexora/neon-rabbit-cyberpunk-avatar.jpg',
  'paper-moons': '/images/nexora/pixel-art-person-avatar.jpg',
  'night-market': '/artwork/night-market-scrolls-2.svg',
  'aether-frames': '/images/nexora/imported/iridescent-sculpted-face.jpg',
  'copper-signal': '/images/nexora/imported/blockchain-network-illustration.jpg',
  'glasswardens': '/images/nexora/imported/onyx-mech-mask.jpg',
  'tideform': '/artwork/tideform-2.svg',
  'nadir-studio': '/images/nexora/imported/pink-haired-anime-character.jpg',
  'ember-archive': '/images/nexora/imported/dark-relic-keeper.jpg',
  'neon-circuit': '/images/nexora/imported/retro-helmet-cyberpunk-avatar.jpg',
  'prism-archives': '/images/nexora/imported/minimal-skull-illustration.jpg',
  'relic-engines': '/images/nexora/imported/purple-altar-artifact.jpg',
}
export const artworkFallbackFor = (collectionId: string) => collectionArtworkFallback[collectionId] ?? '/images/nexora/nft-wordmark-graphic.jpg'


export const collectionCategories: CollectionCategory[] = ['art', 'identity', 'gaming', 'photography', 'membership']

export const networks: Network[] = [
  { id: 'ethereum', name: 'Ethereum', shortName: 'ETH', nativeSymbol: 'ETH', color: '#8ea0c2', layer: 'L1', chainId: 1, docsUrl: 'https://ethereum.org/developers/', explorerUrl: 'https://etherscan.io/', nativeTokenId: 'eth', summary: 'General-purpose smart-contract Layer 1.' },
  { id: 'solana', name: 'Solana', shortName: 'SOL', nativeSymbol: 'SOL', color: '#8fd1c4', layer: 'L1', docsUrl: 'https://solana.com/docs', explorerUrl: 'https://solscan.io/', nativeTokenId: 'sol', summary: 'High-throughput Layer 1 with an account-based runtime.' },
  { id: 'base', name: 'Base', shortName: 'BASE', nativeSymbol: 'ETH', color: '#6ea8ff', layer: 'L2', chainId: 8453, docsUrl: 'https://docs.base.org/', explorerUrl: 'https://basescan.org/', nativeTokenId: 'eth', summary: 'Ethereum Layer 2 built with the OP Stack.' },
  { id: 'polygon', name: 'Polygon', shortName: 'POL', nativeSymbol: 'POL', color: '#b49ae8', layer: 'L2', chainId: 137, docsUrl: 'https://docs.polygon.technology/', explorerUrl: 'https://polygonscan.com/', nativeTokenId: 'pol', summary: 'EVM-compatible network in the Polygon ecosystem.' },
  { id: 'arbitrum', name: 'Arbitrum', shortName: 'ARB', nativeSymbol: 'ETH', color: '#7aa7e0', layer: 'L2', chainId: 42161, docsUrl: 'https://docs.arbitrum.io/', explorerUrl: 'https://arbiscan.io/', nativeTokenId: 'eth', summary: 'Ethereum Layer 2 using optimistic rollup technology.' },
  { id: 'avalanche', name: 'Avalanche', shortName: 'AVAX', nativeSymbol: 'AVAX', color: '#d98a8a', layer: 'L1', chainId: 43114, docsUrl: 'https://build.avax.network/docs', nativeTokenId: 'avax', summary: 'EVM-compatible Layer 1 network for applications and subnets.' },
  { id: 'optimism', name: 'Optimism', shortName: 'OP Mainnet', nativeSymbol: 'ETH', color: '#ff6b6b', layer: 'L2', chainId: 10, docsUrl: 'https://docs.optimism.io/', explorerUrl: 'https://optimistic.etherscan.io/', nativeTokenId: 'eth', summary: 'Ethereum Layer 2 network in the OP Stack ecosystem.' },
]

export const tokens: Token[] = [
  {
    id: 'nex',
    ticker: 'NEX',
    name: 'Nexora',
    networkId: 'ethereum',
    price: 2.48,
    change24h: 6.12,
    marketCap: 186_400_000,
    volume24h: 24_900_000,
    sparkline: spark(3),
    description:
      'Demo utility token used across the NEXORA prototype. Not a live asset.',
    demoNote: 'Fictional demo token',
  },
  {
    id: 'eth',
    ticker: 'ETH',
    name: 'Ether',
    networkId: 'ethereum',
    price: 3284.1,
    change24h: 1.84,
    marketCap: 395_200_000_000,
    volume24h: 12_400_000_000,
    sparkline: spark(8),
    description: 'Settlement asset for Ethereum collections and marketplace quotes in this demo.',
  },
  {
    id: 'sol',
    ticker: 'SOL',
    name: 'Solana',
    networkId: 'solana',
    price: 168.42,
    change24h: -2.31,
    marketCap: 81_200_000_000,
    volume24h: 3_120_000_000,
    sparkline: spark(11),
    description: 'Native asset for Solana identity collections featured in the catalog.',
  },
  {
    id: 'btc',
    ticker: 'BTC',
    name: 'Bitcoin',
    networkId: 'ethereum',
    price: 67240,
    change24h: 0.64,
    marketCap: 1_328_000_000_000,
    volume24h: 28_600_000_000,
    sparkline: spark(2),
    description: 'Reference reserve asset shown for market context. Wrapped quotes only in this prototype.',
    demoNote: 'Wrapped/reference quote in demo; not a native Bitcoin network listing',
  },
  {
    id: 'arb',
    ticker: 'ARB',
    name: 'Arbitrum',
    networkId: 'arbitrum',
    price: 0.82,
    change24h: 3.44,
    marketCap: 3_410_000_000,
    volume24h: 412_000_000,
    sparkline: spark(14),
    description: 'Governance token for the Arbitrum ecosystem cards on Discover.',
  },
  {
    id: 'avax',
    ticker: 'AVAX',
    name: 'Avalanche',
    networkId: 'avalanche',
    price: 28.14,
    change24h: -1.08,
    marketCap: 11_600_000_000,
    volume24h: 540_000_000,
    sparkline: spark(6),
    description: 'Used as the floor quote for Ember Archive and related subnet experiments.',
  },
  {
    id: 'pol',
    ticker: 'POL',
    name: 'Polygon',
    networkId: 'polygon',
    price: 0.41,
    change24h: 0.92,
    marketCap: 4_080_000_000,
    volume24h: 268_000_000,
    sparkline: spark(9),
    description: 'Network token for photography-led collections in the Polygon corridor.',
  },
  {
    id: 'link',
    ticker: 'LINK',
    name: 'Chainlink',
    networkId: 'ethereum',
    price: 14.72,
    change24h: 4.18,
    marketCap: 9_140_000_000,
    volume24h: 612_000_000,
    sparkline: spark(16),
    description: 'Oracle reference used in Copper Signal campaign copy.',
  },
  {
    id: 'uni',
    ticker: 'UNI',
    name: 'Uniswap',
    networkId: 'ethereum',
    price: 8.91,
    change24h: -0.74,
    marketCap: 6_720_000_000,
    volume24h: 390_000_000,
    sparkline: spark(4),
    description: 'Shown as a liquidity benchmark beside token rankings.',
  },
  {
    id: 'aave',
    ticker: 'AAVE',
    name: 'Aave',
    networkId: 'ethereum',
    price: 186.2,
    change24h: 2.55,
    marketCap: 2_790_000_000,
    volume24h: 221_000_000,
    sparkline: spark(18),
    description: 'Lending market marker for the ecosystem strip.',
  },
  {
    id: 'op',
    ticker: 'OP',
    name: 'Optimism',
    networkId: 'optimism',
    price: 1.64,
    change24h: -3.21,
    marketCap: 1_940_000_000,
    volume24h: 178_000_000,
    sparkline: spark(7),
    description: 'L2 comparison quote. Not the settlement chain for listed drops.',
  },
  {
    id: 'tia',
    ticker: 'TIA',
    name: 'Celestia',
    networkId: 'ethereum',
    price: 5.08,
    change24h: 8.42,
    marketCap: 1_120_000_000,
    volume24h: 164_000_000,
    sparkline: spark(21),
    description: 'Modular data-availability reference asset shown for market context; demo pricing only.',
    demoNote: 'Reference quote only; network grouping is illustrative, not a native-chain claim',
  },
  {
    id: 'sui',
    ticker: 'SUI',
    name: 'Sui',
    networkId: 'solana',
    price: 2.11,
    change24h: 1.16,
    marketCap: 6_040_000_000,
    volume24h: 502_000_000,
    sparkline: spark(12),
    description: 'Cross-ecosystem comparison asset. Demo pricing only.',
    demoNote: 'Reference quote only; network grouping is illustrative, not a native-chain claim',
  },
  {
    id: 'rnd',
    ticker: 'RND',
    name: 'Runic',
    networkId: 'base',
    price: 0.094,
    change24h: 12.8,
    marketCap: 41_200_000,
    volume24h: 8_400_000,
    sparkline: spark(25),
    description: 'Fictional Base-native creator token tied to Paper Moons.',
    demoNote: 'Fictional demo token',
  },
  { id: 'usdc', ticker: 'USDC', name: 'USD Coin', networkId: 'ethereum', price: 1, change24h: 0.01, marketCap: 34_500_000_000, volume24h: 5_600_000_000, sparkline: spark(27), description: 'Stablecoin reference asset used for quote and conversion examples.', demoNote: 'Illustrative values; not a live quote.' },
  { id: 'jup', ticker: 'JUP', name: 'Jupiter', networkId: 'solana', price: 0.74, change24h: 2.18, marketCap: 980_000_000, volume24h: 62_000_000, sparkline: spark(29), description: 'Solana ecosystem token used in the demo market list.', demoNote: 'Illustrative values; not a live quote.' },
  { id: 'bonk', ticker: 'BONK', name: 'Bonk', networkId: 'solana', price: 0.000021, change24h: -1.62, marketCap: 1_450_000_000, volume24h: 92_000_000, sparkline: spark(31), description: 'Community-token example for high-volatility market filtering.', demoNote: 'Illustrative values; not a live quote.' },
  { id: 'gmx', ticker: 'GMX', name: 'GMX', networkId: 'arbitrum', price: 23.8, change24h: 0.86, marketCap: 235_000_000, volume24h: 18_000_000, sparkline: spark(33), description: 'Arbitrum ecosystem market reference.', demoNote: 'Illustrative values; not a live quote.' },
  { id: 'wbtc', ticker: 'WBTC', name: 'Wrapped Bitcoin', networkId: 'ethereum', price: 67_240, change24h: 0.64, marketCap: 9_800_000_000, volume24h: 210_000_000, sparkline: spark(35), description: 'Ethereum-wrapped Bitcoin reference asset; not a native Bitcoin network listing.', demoNote: 'Illustrative values; wrapped representation.' },
  { id: 'render', ticker: 'RENDER', name: 'Render', networkId: 'solana', price: 5.62, change24h: 3.05, marketCap: 2_180_000_000, volume24h: 118_000_000, sparkline: spark(37), description: 'Distributed GPU rendering ecosystem reference asset.', demoNote: 'Illustrative values; network grouping is for this demo catalog.' },
  { id: 'zora', ticker: 'ZORA', name: 'Zora', networkId: 'base', price: 0.052, change24h: 5.2, marketCap: 92_000_000, volume24h: 12_000_000, sparkline: spark(39), description: 'Creator-economy reference token for the Base ecosystem.', demoNote: 'Illustrative values; not a live quote.' },
  { id: 'gala', ticker: 'GALA', name: 'Gala', networkId: 'ethereum', price: 0.021, change24h: -0.92, marketCap: 780_000_000, volume24h: 38_000_000, sparkline: spark(41), description: 'Gaming ecosystem reference asset.', demoNote: 'Illustrative values; not a live quote.' },
]

const nft = (
  collection: string,
  index: number,
  photo: string,
  lastSale: number,
  displayName?: string,
): Collection['nfts'][number] => ({
  id: `${collection}-${index}`,
  tokenId: `${collection.toUpperCase().slice(0, 3)}-${String(index).padStart(2, '0')}`,
  name: displayName ?? `${collection} Edition ${String(index).padStart(2, '0')}`,
  // Local artwork paths are used for assets that must never depend on a CDN request.
  image: photo,
  lastSale,
  description: `${displayName ?? `${collection} Edition ${String(index).padStart(2, '0')}`} is a curated sample edition from the ${collection} series. The artwork, last-sale figure, rarity tier, and traits are illustrative catalogue metadata for the NEXORA demo and are not verified on-chain records.`,
  rarity: (['Common', 'Uncommon', 'Rare', 'Epic'] as const)[(index - 1) % 4],
  attributes: [
    { traitType: 'Edition', value: `${collection.toUpperCase().slice(0, 3)}-${String(index).padStart(2, '0')}` },
    { traitType: 'Series', value: collection.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) },
    { traitType: 'Palette', value: /pink|magenta|crimson|red/i.test(photo) ? 'Chromatic' : /blue|cyan|ocean/i.test(photo) ? 'Cool spectrum' : /black|dark|onyx/i.test(photo) ? 'Nocturne' : 'Mixed media' },
    { traitType: 'Composition', value: index % 3 === 0 ? 'Layered' : index % 3 === 1 ? 'Portrait' : 'Object study' },
    { traitType: 'Release', value: index === 4 ? 'Final edition' : index === 1 ? 'Opening edition' : 'Core series' },
  ],
  badgeIds: index === 4 ? ['limited-edition'] : index === 3 ? ['rare-trait'] : [],
  imageAlt: displayName ?? `${collection} collectible artwork`,
  assetId: photo.split('/').pop()?.replace(/\.[^.]+$/, ''),
  isIllustrative: true,
})

export const collections: Collection[] = [
  {
    id: 'lumen-relics',
    slug: 'lumen-relics',
    name: 'Lumen Relics',
    networkId: 'ethereum',
    category: 'art',
    floor: 2.18,
    floorSymbol: 'ETH',
    volume24h: 412.6,
    items: 888,
    owners: 512,
    cover: artworkFor('lumen-relics'),
    banner: artworkFor('lumen-relics-banner'),
    description:
      'A curated series of sculptural light studies built from translucent forms, reflective surfaces, and carefully controlled color. Each edition explores how a single light source changes the character of an object.',
    creatorId: 'atelier-north',
    creator: 'Atelier North',
    linkedTokenId: 'eth',
    nfts: [
      nft('Lumen', 1, '/images/nexora/imported/pink-neural-sculpture.jpg', 2.4, 'Neural Bloom, Study I'),
      nft('Lumen', 2, '/images/nexora/imported/iridescent-crystal-portrait.jpg', 3.1, 'Iridescent Witness No. 02'),
      nft('Lumen', 3, '/images/nexora/imported/blue-glass-portrait.jpg', 1.9, 'Memory in Glass'),
      nft('Lumen', 4, '/images/nexora/imported/chromatic-robot-portrait.jpg', 2.7, 'Chromatic Vessel No. 04'),
    ],
  },
  {
    id: 'obsidian-choir',
    slug: 'obsidian-choir',
    name: 'Obsidian Choir',
    networkId: 'ethereum',
    category: 'art',
    floor: 1.04,
    floorSymbol: 'ETH',
    volume24h: 188.2,
    items: 1500,
    owners: 740,
    cover: artworkFor('obsidian-choir'),
    banner: artworkFor('obsidian-choir-banner'),
    description: 'A portrait collection shaped around dark mineral textures, high-contrast silhouettes, and a restrained crimson palette. Individual works are presented as fragments from one larger visual composition.',
    creatorId: 'vesper-lab',
    creator: 'Vesper Lab',
    linkedTokenId: 'eth',
    nfts: [
      nft('Choir', 1, '/images/nexora/imported/black-orbit-figure.jpg', 1.2, 'Silent Orbit'),
      nft('Choir', 2, '/images/nexora/imported/crimson-halo-silhouette.jpg', 0.9, 'Crimson Canticle No. 02'),
      nft('Choir', 3, '/images/nexora/imported/red-grid-human-portrait.jpg', 1.5, 'Redacted Portrait'),
      nft('Choir', 4, '/images/nexora/imported/wireframe-face-study.jpg', 1.1, 'Wireframe Hymn'),
    ],
  },
  {
    id: 'drift-avatars',
    slug: 'drift-avatars',
    name: 'Drift Avatars',
    networkId: 'solana',
    category: 'identity',
    floor: 42.5,
    floorSymbol: 'SOL',
    volume24h: 9804,
    items: 4444,
    owners: 2104,
    cover: artworkFor('drift-avatars'),
    banner: artworkFor('drift-avatars-banner'),
    description: 'A fictional identity series built around navigation, city routes, and cybernetic travel gear. Traits describe a character’s imagined route profile rather than implying real protocol access or account credentials.',
    creatorId: 'drift-protocol',
    creator: 'Drift Protocol',
    linkedTokenId: 'sol',
    nfts: [
      nft('Drift', 1, '/images/nexora/imported/cyberpunk-pilot-portrait.jpg', 51, 'Wayfinder: First Light'),
      nft('Drift', 2, '/images/nexora/imported/neon-vr-streetwear-portrait.jpg', 38, 'Signal Runner No. 02'),
      nft('Drift', 3, '/images/nexora/imported/magenta-vr-visor-avatar.jpg', 44, 'Orbit Passport No. 03'),
      nft('Drift', 4, '/images/nexora/imported/blue-haired-cyberpunk-portrait.jpg', 60, 'Neon Cartographer No. 04'),
    ],
  },
  {
    id: 'paper-moons',
    slug: 'paper-moons',
    name: 'Paper Moons',
    networkId: 'base',
    category: 'art',
    floor: 0.21,
    floorSymbol: 'ETH',
    volume24h: 64.8,
    items: 333,
    owners: 201,
    cover: artworkFor('paper-moons'),
    banner: artworkFor('paper-moons-banner'),
    description: 'A paper-craft universe of miniature lunar scenes, soft pigments, and companion characters. Editions are released in small narrative chapters, with each piece extending the same imagined night sky.',
    creatorId: 'kite-studio',
    creator: 'Kite Studio',
    linkedTokenId: 'eth',
    nfts: [
      nft('Moon', 1, '/images/nexora/imported/pastel-cat-avatar.jpg', 0.31, 'Moonlit Companion No. 01'),
      nft('Moon', 2, '/images/nexora/imported/mint-cat-streetwear-avatar.jpg', 0.22, 'Mint Moon Companion'),
      nft('Moon', 3, '/images/nexora/imported/blue-cat-anime-avatar.jpg', 0.18, 'Blue Moon Companion'),
      nft('Moon', 4, '/images/nexora/imported/pink-skater-character.jpg', 0.44, 'Comet on Paper'),
    ],
  },
  {
    id: 'night-market',
    slug: 'night-market-scrolls',
    name: 'Night Market Scrolls',
    networkId: 'solana',
    category: 'membership',
    floor: 9.4,
    floorSymbol: 'SOL',
    volume24h: 1204,
    items: 777,
    owners: 501,
    cover: artworkFor('night-market'),
    banner: artworkFor('night-market-banner'),
    description: 'A fictional membership series for an after-hours digital bazaar. Each scroll represents a themed access pass, pairing vendor-map motifs with collectible details and rotating community-room concepts.',
    creatorId: 'night-market-dao',
    creator: 'Night Market DAO',
    linkedTokenId: 'sol',
    nfts: [
      nft('Scroll', 1, '/artwork/night-market-scrolls-1.svg', 11, 'Lantern Route Pass'),
      nft('Scroll', 2, '/artwork/night-market-scrolls-2.svg', 8.2, 'The Copper Stall'),
      nft('Scroll', 3, '/artwork/night-market-scrolls-3.svg', 13.4, 'After-Hours Atlas'),
      nft('Scroll', 4, '/artwork/night-market-scrolls-4.svg', 9.1, 'Midnight Vendor Seal'),
    ],
  },
  {
    id: 'aether-frames',
    slug: 'aether-frames',
    name: 'Aether Frames',
    networkId: 'arbitrum',
    category: 'art',
    floor: 0.62,
    floorSymbol: 'ETH',
    volume24h: 91.4,
    items: 512,
    owners: 308,
    cover: artworkFor('aether-frames'),
    banner: artworkFor('aether-frames-banner'),
    description: 'A generative-art study of negative space, refracted color, and fragmented portraits. The series treats each frame as a window into a different visual signal, with palette and composition changing across editions.',
    creatorId: 'frame-office',
    creator: 'Frame Office',
    linkedTokenId: 'eth',
    nfts: [
      nft('Aether', 1, '/images/nexora/imported/glitch-fusion-portrait.jpg', 0.7, 'Glitch Bloom No. 01'),
      nft('Aether', 2, '/images/nexora/imported/faceted-purple-creature.jpg', 0.55, 'Faceted Reverie'),
      nft('Aether', 3, '/images/nexora/imported/color-fragmented-face.jpg', 0.81, 'Fractured Spectrum'),
      nft('Aether', 4, '/images/nexora/imported/astronaut-helmet-generative-art.jpg', 0.6, 'Frame Beyond Orbit'),
    ],
  },
  {
    id: 'copper-signal',
    slug: 'copper-signal',
    name: 'Copper Signal',
    networkId: 'ethereum',
    category: 'membership',
    floor: 3.9,
    floorSymbol: 'ETH',
    volume24h: 276.5,
    items: 200,
    owners: 188,
    cover: artworkFor('copper-signal'),
    banner: artworkFor('copper-signal-banner'),
    description: 'A research-oriented membership concept for collectors who prefer annotated market context over spectacle. Its visual language combines signal diagrams, metallic surfaces, and compact editorial layouts.',
    creatorId: 'copper-dao',
    creator: 'Copper Signal DAO',
    linkedTokenId: 'eth',
    nfts: [
      nft('Signal', 1, '/images/nexora/bitcoin-gold-orb.jpg', 4.2, 'Amber Signal Beacon'),
      nft('Signal', 2, '/images/nexora/green-neon-gamer-avatar.jpg', 3.7, 'Greenline Operator'),
      nft('Signal', 3, '/images/nexora/nft-wordmark-graphic.jpg', 5.1, 'Signal Desk Insignia'),
      nft('Signal', 4, '/images/nexora/crowned-cartoon-face.jpg', 3.9, 'Copper Crown Emblem'),
    ],
  },
  {
    id: 'glasswardens',
    slug: 'glasswardens',
    name: 'Glasswardens',
    networkId: 'base',
    category: 'gaming',
    floor: 0.08,
    floorSymbol: 'ETH',
    volume24h: 22.1,
    items: 5555,
    owners: 1902,
    cover: artworkFor('glasswardens'),
    banner: artworkFor('glasswardens-banner'),
    description: 'A fictional game-world collection of crystalline sentinels, sealed gates, and energy cores. Each character is designed as an artifact from a glass-built city, with visual traits tied to its imagined role.',
    creatorId: 'glasswardens-studio',
    creator: 'Tideform Labs',
    linkedTokenId: 'eth',
    nfts: [
      nft('Warden', 1, '/images/nexora/imported/storm-eye-crystal-orb.jpg', 0.11, 'Stormglass Sentinel'),
      nft('Warden', 2, '/images/nexora/imported/onyx-mech-mask.jpg', 0.07, 'Onyx Gatekeeper No. 02'),
      nft('Warden', 3, '/images/nexora/imported/violet-tech-crystal.jpg', 0.14, 'Violet Core No. 03'),
      nft('Warden', 4, '/images/nexora/imported/black-red-energy-artifact.jpg', 0.09, 'Riftwatch Keeper'),
    ],
  },
  {
    id: 'tideform',
    slug: 'tideform',
    name: 'Tideform',
    networkId: 'arbitrum',
    category: 'photography',
    floor: 0.33,
    floorSymbol: 'ETH',
    volume24h: 41.7,
    items: 180,
    owners: 96,
    cover: artworkFor('tideform'),
    banner: artworkFor('tideform-banner'),
    description: 'A photography-inspired series documenting imagined coastlines through long exposure, layered horizons, and tidal color studies. Edition details reference the rhythm and movement of water rather than a specific real-world location.',
    creatorId: 'tideform-labs',
    creator: 'Tideform Labs',
    linkedTokenId: 'eth',
    nfts: [
      nft('Tide', 1, '/artwork/tideform-1.svg', 0.4, 'First Tide Line'),
      nft('Tide', 2, '/artwork/tideform-2.svg', 0.29, 'Low Water Study'),
      nft('Tide', 3, '/artwork/tideform-3.svg', 0.36, 'Blue Current Archive'),
      nft('Tide', 4, '/artwork/tideform-4.svg', 0.31, 'Horizon After Rain'),
    ],
  },
  {
    id: 'nadir-studio',
    slug: 'nadir-studio',
    name: 'Nadir Studio',
    networkId: 'polygon',
    category: 'art',
    floor: 90,
    floorSymbol: 'POL',
    volume24h: 6400,
    items: 96,
    owners: 71,
    cover: artworkFor('nadir-studio'),
    banner: artworkFor('nadir-studio-banner'),
    description: 'An independent portrait series focused on expressive silhouettes, saturated color, and character-led composition. The studio presents each work as a small-run art edition with a distinct visual mood.',
    creatorId: 'nadir',
    creator: 'Nadir',
    linkedTokenId: 'pol',
    nfts: [
      nft('Nadir', 1, '/images/nexora/imported/cosmic-girl-avatar.jpg', 120, 'Afterglow, in Profile'),
      nft('Nadir', 2, '/images/nexora/imported/anime-warrior-red-backdrop.jpg', 88, 'Redline Portrait'),
      nft('Nadir', 3, '/images/nexora/imported/magenta-cap-streetwear-avatar.jpg', 101, 'Magenta Reverie'),
      nft('Nadir', 4, '/images/nexora/imported/silver-haired-mask-avatar.jpg', 77, 'Silver Veil Portrait'),
    ],
  },
  {
    id: 'ember-archive',
    slug: 'ember-archive',
    name: 'Ember Archive',
    networkId: 'avalanche',
    category: 'gaming',
    floor: 18.6,
    floorSymbol: 'AVAX',
    volume24h: 2410,
    items: 3000,
    owners: 1288,
    cover: artworkFor('ember-archive'),
    banner: artworkFor('ember-archive-banner'),
    description: 'A fictional game collectible series set in an ash-covered world of dormant machines and recovered artifacts. Each piece is framed as equipment or evidence from a turn-based expedition, with rarity labels used only for this demo.',
    creatorId: 'ember',
    creator: 'Ember Archive',
    linkedTokenId: 'avax',
    nfts: [
      nft('Ember', 1, '/images/nexora/imported/dark-relic-keeper.jpg', 22, 'Keeper of Embers'),
      nft('Ember', 2, '/images/nexora/imported/magnetar-mech-core.jpg', 16, 'Magnetar Heart'),
      nft('Ember', 3, '/images/nexora/imported/ancient-planetary-orb.jpg', 19, 'Orbit of Antiquity'),
      nft('Ember', 4, '/images/nexora/imported/celestial-relic-in-glass.jpg', 25, 'Celestial Reliquary'),
    ],
  },
  {
    id: 'neon-circuit', slug: 'neon-circuit', name: 'Neon Circuit', networkId: 'solana', category: 'identity',
    floor: 18.2, floorSymbol: 'SOL', volume24h: 2260, items: 1200, owners: 642,
    cover: '/images/nexora/imported/neon-headset-avatar.jpg', banner: '/images/nexora/imported/neon-purple-racing-banner.jpg',
    description: 'A cyberpunk identity series featuring night-shift pilots, augmented-reality visors, and city-light palettes. Each portrait is written as a character profile from a fictional metropolitan network.',
    creator: 'Circuit Atelier', linkedTokenId: 'sol', badgeIds: ['new-series', 'featured'], tags: ['cyberpunk', 'identity', 'avatar'], standard: 'Metaplex-compatible demo metadata', royaltyBps: 500, verificationStatus: 'demo-only', creatorId: 'circuit-atelier',
    nfts: [
      nft('Circuit', 1, '/images/nexora/imported/retro-helmet-cyberpunk-avatar.jpg', 17.8, 'Redline Navigator'),
      nft('Circuit', 2, '/images/nexora/imported/violet-hooded-cyberpunk-portrait.jpg', 19.4, 'Ghost Signal'),
      nft('Circuit', 3, '/images/nexora/imported/neon-headset-avatar.jpg', 22.1, 'Signal Bloom No. 03'),
      nft('Circuit', 4, '/images/nexora/imported/red-visor-helmet-avatar.jpg', 25.6, 'Runner at Last Light'),
    ],
  },
  {
    id: 'prism-archives', slug: 'prism-archives', name: 'Prism Archives', networkId: 'ethereum', category: 'art',
    floor: 0.84, floorSymbol: 'ETH', volume24h: 136.8, items: 640, owners: 388,
    cover: '/images/nexora/imported/iridescent-sculpted-face.jpg', banner: '/images/nexora/imported/monochrome-violet-wave-banner.jpg',
    description: 'A generative portrait archive exploring fragmented geometry, scan-line noise, synthetic materials, and shifting color fields. Editions are grouped as visual experiments rather than representations of real people.',
    creator: 'Prism Bureau', linkedTokenId: 'eth', badgeIds: ['new-series', 'generative'], tags: ['generative-art', 'portraiture', 'glitch'], standard: 'ERC-721 demo metadata', royaltyBps: 750, verificationStatus: 'demo-only', creatorId: 'prism-bureau',
    nfts: [
      nft('Prism', 1, '/images/nexora/imported/generative-fragmented-portrait.jpg', 0.72, 'Fragmented Form No. 01'),
      nft('Prism', 2, '/images/nexora/imported/pixel-noise-portrait.jpg', 0.91, 'Signal Noise Study'),
      nft('Prism', 3, '/images/nexora/imported/surreal-red-blue-profile.jpg', 0.79, 'Dual Spectrum Portrait'),
      nft('Prism', 4, '/images/nexora/imported/digital-mona-pattern-study.jpg', 1.02, 'Archive of Patterns'),
    ],
  },
  {
    id: 'relic-engines', slug: 'relic-engines', name: 'Relic Engines', networkId: 'avalanche', category: 'gaming',
    floor: 12.4, floorSymbol: 'AVAX', volume24h: 1830, items: 900, owners: 477,
    cover: '/images/nexora/imported/magnetar-mech-core.jpg', banner: '/images/nexora/imported/purple-light-tunnel-banner.jpg',
    description: 'A science-fiction artifact collection built around machine cores, sealed chambers, and ancient synthetic guardians. Its item metadata connects each object to a fictional expedition and a clear visual role.',
    creator: 'Forge Signal', linkedTokenId: 'avax', badgeIds: ['new-series', 'game-ready'], tags: ['sci-fi', 'artifacts', 'gaming'], standard: 'Avalanche C-Chain demo metadata', royaltyBps: 500, verificationStatus: 'demo-only', creatorId: 'forge-signal',
    nfts: [
      nft('Relic', 1, '/images/nexora/imported/pixelated-woodland-collectible.jpg', 11.8, 'Pixel Relic No. 01'),
      nft('Relic', 2, '/images/nexora/imported/purple-altar-artifact.jpg', 12.9, 'The Echo Vault'),
      nft('Relic', 3, '/images/nexora/imported/blue-astronaut-portrait.jpg', 13.7, 'Astral Engine'),
      nft('Relic', 4, '/images/nexora/imported/iridescent-sculpted-face.jpg', 15.2, 'Iridescent Sentinel'),
    ],
  },
]

export const projects: Project[] = [
  {
    id: 'drift-protocol',
    name: 'Drift Protocol',
    tagline: 'Identity that remembers the route, not the costume.',
    networkId: 'solana',
    category: 'Identity',
    cover: artworkFor('drift-avatars'),
    collectionId: 'drift-avatars',
  },
  {
    id: 'copper-dao',
    name: 'Copper Signal',
    tagline: 'Research desks without the carnival lighting.',
    networkId: 'ethereum',
    category: 'Membership',
    cover: artworkFor('copper-signal'),
    collectionId: 'copper-signal',
  },
  {
    id: 'tideform-labs',
    name: 'Tideform Labs',
    tagline: 'Coastal survey work that became a game world.',
    networkId: 'arbitrum',
    category: 'Studio',
    cover: artworkFor('tideform'),
    collectionId: 'tideform',
  },
  {
    id: 'ember',
    name: 'Ember Archive',
    tagline: 'Turn-based relics, stored like museum inventory.',
    networkId: 'avalanche',
    category: 'Games',
    cover: artworkFor('ember-archive'),
    collectionId: 'ember-archive',
  },
  {
    id: 'kite',
    name: 'Kite Studio',
    tagline: 'Paper, moons, and very slow mint calendars.',
    networkId: 'base',
    category: 'Studio',
    cover: artworkFor('paper-moons'),
    collectionId: 'paper-moons',
  },
  { id: 'atelier-north', name: 'Atelier North', tagline: 'Sculptural light studies and carefully sequenced digital editions.', networkId: 'ethereum', category: 'Art', cover: artworkFor('lumen-relics'), collectionId: 'lumen-relics' },
  { id: 'vesper-lab', name: 'Vesper Lab', tagline: 'Dark mineral portraits composed as a collective visual score.', networkId: 'ethereum', category: 'Art', cover: artworkFor('obsidian-choir'), collectionId: 'obsidian-choir' },
  { id: 'night-market-dao', name: 'Night Market DAO', tagline: 'Access passes and digital keepsakes for after-hours culture.', networkId: 'solana', category: 'Membership', cover: artworkFor('night-market'), collectionId: 'night-market' },
  { id: 'frame-office', name: 'Frame Office', tagline: 'Minimal frames, color studies, and generative art experiments.', networkId: 'arbitrum', category: 'Art', cover: artworkFor('aether-frames'), collectionId: 'aether-frames' },
  { id: 'glasswardens-studio', name: 'Glasswardens Studio', tagline: 'Playable guardians and artifacts from a glass-city world.', networkId: 'base', category: 'Games', cover: artworkFor('glasswardens'), collectionId: 'glasswardens' },
  { id: 'nadir', name: 'Nadir Studio', tagline: 'Small-run art editions with expressive color and character.', networkId: 'polygon', category: 'Art', cover: artworkFor('nadir-studio'), collectionId: 'nadir-studio' },

  { id: 'circuit-atelier', name: 'Circuit Atelier', tagline: 'Avatar studies from a fictional after-dark network.', networkId: 'solana', category: 'Identity', cover: '/images/nexora/imported/neon-headset-avatar.jpg', collectionId: 'neon-circuit', status: 'building', badgeIds: ['new-series'], tags: ['avatars', 'cyberpunk'], creatorId: 'circuit-atelier' },
  { id: 'prism-bureau', name: 'Prism Bureau', tagline: 'Generative portraiture, fragmented light, and signal noise.', networkId: 'ethereum', category: 'Generative Art', cover: '/images/nexora/imported/iridescent-sculpted-face.jpg', collectionId: 'prism-archives', status: 'active', badgeIds: ['generative'], tags: ['art', 'generative'], creatorId: 'prism-bureau' },
  { id: 'forge-signal', name: 'Forge Signal', tagline: 'A fictional archive of relics and machine guardians.', networkId: 'avalanche', category: 'Gaming', cover: '/images/nexora/imported/magnetar-mech-core.jpg', collectionId: 'relic-engines', status: 'building', badgeIds: ['game-ready'], tags: ['gaming', 'artifacts'], creatorId: 'forge-signal' },
]

export const campaigns: Campaign[] = [
  {
    id: 'second-eclipse',
    title: 'Second Eclipse',
    subtitle: 'Lumen Relics · Chapter II',
    startsAt: 'Live now',
    status: 'live',
    collectionId: 'lumen-relics',
    cover: artworkFor('lumen-relics-banner'),
  },
  {
    id: 'chapter-iii',
    title: 'Paper Moons, Chapter III',
    subtitle: 'Night market folding session',
    startsAt: 'Opens in 2d',
    status: 'upcoming',
    collectionId: 'paper-moons',
    cover: artworkFor('paper-moons-banner'),
  },
  {
    id: 'vault-opening',
    title: 'Vault Opening',
    subtitle: 'Glasswardens · Season 1',
    startsAt: 'Live now',
    status: 'live',
    collectionId: 'glasswardens',
    cover: artworkFor('glasswardens-banner'),
  },
  { id: 'night-market-opening', title: 'Night Market: After Hours', subtitle: 'Night Market Scrolls · Access window', startsAt: 'Opens Oct 22 · demo schedule', status: 'upcoming', collectionId: 'night-market', cover: artworkFor('night-market-banner') },
  { id: 'drift-wayfinder-season', title: 'Wayfinder Season', subtitle: 'Drift Avatars · Route chapter', startsAt: 'Opens Oct 25 · demo schedule', status: 'upcoming', collectionId: 'drift-avatars', cover: artworkFor('drift-avatars-banner') },
  { id: 'copper-signal-session', title: 'Signal Session 02', subtitle: 'Copper Signal · Member briefing', startsAt: 'Ended Oct 10 · demo schedule', status: 'ended', collectionId: 'copper-signal', cover: artworkFor('copper-signal-banner') },
  { id: 'nadir-color-study', title: 'Color Study: No. 09', subtitle: 'Nadir Studio · Limited art edition', startsAt: 'Live now · demo campaign', status: 'live', collectionId: 'nadir-studio', cover: artworkFor('nadir-studio-banner') },
  { id: 'ember-relic-run', title: 'Relic Run', subtitle: 'Ember Archive · Season challenge', startsAt: 'Opens Oct 29 · demo schedule', status: 'upcoming', collectionId: 'ember-archive', cover: artworkFor('ember-archive-banner') },

  { id: 'circuit-after-dark', title: 'Circuit: After Dark', subtitle: 'Neon Circuit · Avatar chapter', startsAt: 'Opens Nov 02 · demo schedule', status: 'upcoming', collectionId: 'neon-circuit', cover: '/images/nexora/imported/neon-purple-racing-banner.jpg', networkId: 'solana', creatorId: 'circuit-atelier', badgeIds: ['upcoming', 'new-series'], rewardType: 'nft', supply: 1200, mintPrice: 18, mintCurrencyTokenId: 'sol', eligibilitySummary: 'Demo-only campaign; no wallet, mint, or reward is available.', isIllustrative: true },
  { id: 'prism-signal-study', title: 'Prism: Signal Study', subtitle: 'Prism Archives · Generative edition', startsAt: 'Live in demo', status: 'live', collectionId: 'prism-archives', cover: '/images/nexora/imported/monochrome-violet-wave-banner.jpg', networkId: 'ethereum', creatorId: 'prism-bureau', badgeIds: ['live', 'generative'], rewardType: 'nft', supply: 640, mintPrice: 0.84, mintCurrencyTokenId: 'eth', eligibilitySummary: 'Illustrative campaign record; not a real mint.', isIllustrative: true },
  { id: 'relic-engine-awakening', title: 'Engine Awakening', subtitle: 'Relic Engines · Artifact release', startsAt: 'Opens Nov 08 · demo schedule', status: 'upcoming', collectionId: 'relic-engines', cover: '/images/nexora/imported/purple-light-tunnel-banner.jpg', networkId: 'avalanche', creatorId: 'forge-signal', badgeIds: ['upcoming', 'game-ready'], rewardType: 'nft', supply: 900, mintPrice: 12.4, mintCurrencyTokenId: 'avax', eligibilitySummary: 'Fictional demo campaign with no live claim or transaction.', isIllustrative: true },
]


// Complete records with consistent metadata used by future filters, badges, and detail pages.
for (const token of tokens) {
  token.assetClass ??= token.id === 'nex' || token.id === 'rnd' ? 'fictional' : token.id === 'usdc' ? 'stablecoin' : token.id === 'wbtc' ? 'wrapped' : ['arb', 'op', 'uni', 'aave'].includes(token.id) ? 'governance' : 'native'
  token.decimals ??= token.id === 'btc' || token.id === 'wbtc' ? 8 : token.id === 'usdc' ? 6 : token.id === 'sol' ? 9 : 18
  token.isStablecoin ??= token.id === 'usdc'
  token.verifiedProject ??= !['nex', 'rnd'].includes(token.id)
  token.supportedNetworkIds ??= token.id === 'eth' ? ['ethereum', 'base', 'arbitrum', 'optimism'] : [token.networkId]
  token.badgeIds ??= token.id === 'usdc' ? ['stable-reference'] : token.id === 'nex' || token.id === 'rnd' ? ['demo-asset'] : []
}
for (const collection of collections) {
  collection.tags ??= [collection.category, collection.networkId, 'demo-catalog']
  collection.badgeIds ??= collection.id === 'drift-avatars' || collection.id === 'lumen-relics' ? ['featured'] : []
  collection.standard ??= collection.networkId === 'solana' ? 'Metaplex-style metadata · illustrative' : 'ERC-compatible metadata · illustrative'
  collection.royaltyBps ??= collection.category === 'art' ? 750 : 500
  collection.verificationStatus ??= 'demo-only'
  collection.mintStatus ??= 'unknown'
  collection.supplyDescription ??= `${collection.items.toLocaleString('en-US')} total items reported in the illustrative catalogue; ${collection.nfts.length} sample records are included locally.`
  collection.marketContext ??= `Floor and 24-hour volume are sample ${collection.floorSymbol} figures for UI demonstration, not live marketplace quotes.`
}
for (const project of projects) {
  project.status ??= 'active'
  project.tags ??= [project.category.toLowerCase(), project.networkId, 'demo-project']
  project.badgeIds ??= []
}
for (const campaign of campaigns) {
  const parent = collections.find((collection) => collection.id === campaign.collectionId)
  campaign.networkId ??= parent?.networkId
  campaign.creatorId ??= parent?.creatorId
  campaign.badgeIds ??= campaign.status === 'live' ? ['live'] : campaign.status === 'upcoming' ? ['upcoming'] : []
  campaign.rewardType ??= 'nft'
  campaign.supply ??= parent?.items
  campaign.mintCurrencyTokenId ??= parent?.linkedTokenId
  campaign.eligibilitySummary ??= 'Demo-only listing. No wallet connection, mint, or reward is available.'
  campaign.isIllustrative ??= true
}


// Additional locally bundled NFT artwork. Each image is assigned exactly once, with
// explicit collection ownership so detail pages, collection pages, and rails stay related.
const additionalNftArtwork = [
  { name: "Aurora Glass Study", image: "/images/NFT_More/Nft1.avif" },
  { name: "Velvet Frequency", image: "/images/NFT_More/Nft2.avif" },
  { name: "Courier at Dusk", image: "/images/NFT_More/Nft3.avif" },
  { name: "Prism in Motion", image: "/images/NFT_More/Nft4.avif" },
  { name: "Chrome Daydream", image: "/images/NFT_More/Nft5.avif" },
  { name: "Solaris Fragment", image: "/images/NFT_More/Nft6.avif" },
  { name: "The Quiet Archive", image: "/images/NFT_More/Nft7.avif" },
  { name: "Afterimage No. 01", image: "/images/NFT_More/Nft8.avif" },
  { name: "Orbit Keepsake No. 01", image: "/images/NFT_More/Nft9.avif" },
  { name: "Petals in Transmission", image: "/images/NFT_More/Nft10.avif" },
  { name: "Vesper Afterglow", image: "/images/NFT_More/Nft11.avif" },
  { name: "Violet Dispatch", image: "/images/NFT_More/Nft12.avif" },
  { name: "Soft Machinery", image: "/images/NFT_More/Nft13.avif" },
  { name: "Pixel Wayfarer", image: "/images/NFT_More/Nft14.avif" },
  { name: "Vessel of Echoes", image: "/images/NFT_More/Nft15.avif" },
  { name: "Neon Field Notes", image: "/images/NFT_More/Nft16.avif" },
  { name: "Amber Sentinel", image: "/images/NFT_More/Nft17.avif" },
  { name: "Circuit of Dreams", image: "/images/NFT_More/Nft18.png" },
  { name: "Static Bloom", image: "/images/NFT_More/Nft19.avif" },
  { name: "Cloud Cartographer", image: "/images/NFT_More/Nft20.avif" },
  { name: "The Last Blue Hour", image: "/images/NFT_More/Nft21.avif" },
  { name: "Blue Hour Relic", image: "/images/NFT_More/Nft22.avif" },
  { name: "Analog Apparition", image: "/images/NFT_More/Nft23.avif" },
  { name: "Postcard from Elsewhere", image: "/images/NFT_More/Nft24.avif" },
] as const

const nftCollectionOrder = [
  'lumen-relics', 'obsidian-choir', 'drift-avatars', 'paper-moons',
  'night-market', 'aether-frames', 'copper-signal', 'glasswardens', 'tideform',
  'nadir-studio', 'ember-archive', 'neon-circuit', 'prism-archives', 'relic-engines',
] as const

// Track IDs globally, not only within each collection. This guards against
// stale or malformed edition suffixes and collections that share a short prefix.
const usedNftIds = new Set(collections.flatMap((collection) => collection.nfts.map((item) => item.id)))
const usedNftTokenIds = new Set(collections.flatMap((collection) => collection.nfts.map((item) => item.tokenId)))
const usedNftNames = new Set(collections.flatMap((collection) => collection.nfts.map((item) => item.name)))
const usedNftArtwork = new Set(collections.flatMap((collection) => collection.nfts.map((item) => item.image)))

for (const [index, artwork] of additionalNftArtwork.entries()) {
  const collectionId = nftCollectionOrder[index % nftCollectionOrder.length]
  const collection = collections.find((item) => item.id === collectionId)
  if (!collection) continue

  const prefix = collection.nfts[0]?.id.split('-')[0] ?? collection.name.split(' ')[0]
  const nextIndexForCollection = collection.nfts.reduce((max, item) => {
    const suffix = Number(item.id.split('-').at(-1)) || 0
    return Math.max(max, suffix)
  }, 0) + 1
  let nextIndex = nextIndexForCollection
  let candidate = nft(prefix, nextIndex, artwork.image, 0, artwork.name)

  // Always advance until both the primary React key and token ID are globally unique.
  while (usedNftIds.has(candidate.id) || usedNftTokenIds.has(candidate.tokenId)) {
    nextIndex += 1
    candidate = nft(prefix, nextIndex, artwork.image, 0, artwork.name)
  }

  const saleMultiplier = 0.82 + ((index * 17) % 39) / 100
  const sale = Number((collection.floor * saleMultiplier).toFixed(3))
  const added = { ...candidate, lastSale: sale }
  // Keep the catalog valid even if this list is edited in the future.
  if (usedNftNames.has(added.name) || usedNftArtwork.has(added.image)) {
    console.warn(`[NEXORA catalog seed] Skipping duplicate NFT name/artwork for ${collection.id}: ${added.name}`)
    continue
  }
  collection.nfts.push(added)
  usedNftIds.add(added.id)
  usedNftTokenIds.add(added.tokenId)
  usedNftNames.add(added.name)
  usedNftArtwork.add(added.image)
}

export const catalog: Catalog = {
  networks,
  tokens,
  collections,
  projects,
  campaigns,
}

export const DEMO_BANNER = 'All figures are labeled demo data. No live chain reads.'


/** Enrich the source records before deriving the normalized NFT read model. */
for (const collection of collections) {
  for (const item of collection.nfts) {
    item.creatorId ??= collection.creatorId
    item.collectionSupply ??= collection.items
    item.creatorName ??= collection.creator
    item.networkName ??= networks.find((network) => network.id === collection.networkId)?.name
    item.contentType ??= collection.category === 'photography' ? 'Digital photography study' : collection.category === 'identity' ? 'Character portrait' : collection.category === 'gaming' ? 'Game-world collectible' : collection.category === 'membership' ? 'Membership collectible' : 'Digital artwork'
    item.provenance ??= 'Locally seeded NEXORA demo record; no token URI or on-chain ownership has been verified.'
    item.utility ??= collection.category === 'membership' ? 'Illustrative access-pass concept; no real-world access is granted.' : collection.category === 'gaming' ? 'Illustrative game-world item; no game entitlement is connected.' : 'Collectible artwork record for catalogue exploration.'
    const categoryContext = collection.category === 'photography' ? 'light, atmosphere, and environmental composition' : collection.category === 'identity' ? 'character design, route motifs, and personal visual identity' : collection.category === 'gaming' ? 'world-building, equipment design, and fictional item roles' : collection.category === 'membership' ? 'community identity and an imagined access-pass format' : 'form, material, and color relationships'
    item.description = `${item.name} is a sample edition from ${collection.name}. The piece explores ${categoryContext}; its palette and composition are documented as catalogue traits to make comparisons easier. All price, rarity, ownership, and edition information is illustrative demo data rather than verified on-chain metadata.`
    item.curatorNote ??= `Curated for its ${item.attributes?.find((trait) => trait.traitType === 'Palette')?.value?.toString().toLowerCase() ?? 'distinctive'} visual treatment and its place in the ${collection.name} series.`
    item.rarityBasis ??= 'Illustrative catalogue tier only; no verified on-chain rarity calculation is available.'
    item.lastSaleContext ??= `Sample last-sale value in ${collection.floorSymbol}; not a live or independently verified transaction.`
  }
}

/** Normalized NFT read model with explicit parent collection foreign keys. */
export type CatalogNftItem = NftItem & {
  collectionId: string
  collectionSlug: string
  collectionName: string
  networkId: NetworkId
}
export const nftItems: CatalogNftItem[] = collections.flatMap((collection) =>
  collection.nfts.map((item) => ({ ...item, collectionId: collection.id, collectionSlug: collection.slug, collectionName: collection.name, networkId: collection.networkId })),
)
export const collectionById = Object.fromEntries(collections.map((item) => [item.id, item])) as Record<string, Collection>
export const tokenById = Object.fromEntries(tokens.map((item) => [item.id, item])) as Record<string, Token>
export const networkById = Object.fromEntries(networks.map((item) => [item.id, item])) as Record<NetworkId, Network>
export const projectById = Object.fromEntries(projects.map((item) => [item.id, item])) as Record<string, Project>
export const campaignById = Object.fromEntries(campaigns.map((item) => [item.id, item])) as Record<string, Campaign>

/** Foreign-key and uniqueness validation for the seeded demo catalogue. */
export function validateCatalogIntegrity(): string[] {
  const errors: string[] = []
  const unique = (label: string, ids: string[]) => {
    const seen = new Set<string>()
    for (const id of ids) { if (seen.has(id)) errors.push(`Duplicate ${label} id: ${id}`); seen.add(id) }
  }
  unique('network', networks.map((x) => x.id)); unique('token', tokens.map((x) => x.id)); unique('collection', collections.map((x) => x.id)); unique('project', projects.map((x) => x.id)); unique('campaign', campaigns.map((x) => x.id)); unique('NFT', nftItems.map((x) => x.id))
  unique('NFT token', nftItems.map((x) => x.tokenId))
  unique('NFT name', nftItems.map((x) => x.name))
  unique('NFT artwork path', nftItems.map((x) => x.image))
  const networkIds = new Set(networks.map((x) => x.id)); const tokenIds = new Set(tokens.map((x) => x.id)); const collectionIds = new Set(collections.map((x) => x.id)); const projectIds = new Set(projects.map((x) => x.id))
  for (const token of tokens) if (!networkIds.has(token.networkId)) errors.push(`Token ${token.id} references missing network ${token.networkId}`)
  for (const collection of collections) {
    if (!networkIds.has(collection.networkId)) errors.push(`Collection ${collection.id} references missing network ${collection.networkId}`)
    if (collection.linkedTokenId && !tokenIds.has(collection.linkedTokenId)) errors.push(`Collection ${collection.id} references missing quote token ${collection.linkedTokenId}`)
    const linked = collection.linkedTokenId ? tokenById[collection.linkedTokenId] : undefined
    if (linked && linked.ticker !== collection.floorSymbol) errors.push(`Collection ${collection.id} floor symbol ${collection.floorSymbol} does not match linked quote token ${linked.ticker}`)
    if (collection.nfts.length === 0) errors.push(`Collection ${collection.id} has no sample NFT items`)
  }
  for (const project of projects) {
    if (!networkIds.has(project.networkId)) errors.push(`Project ${project.id} references missing network ${project.networkId}`)
    if (project.collectionId && !collectionIds.has(project.collectionId)) errors.push(`Project ${project.id} references missing collection ${project.collectionId}`)
    const linkedCollection = project.collectionId ? collectionById[project.collectionId] : undefined
    if (linkedCollection && linkedCollection.networkId !== project.networkId) errors.push(`Project ${project.id} network does not match collection ${project.collectionId}`)
  }
  for (const campaign of campaigns) {
    if (!collectionIds.has(campaign.collectionId)) errors.push(`Campaign ${campaign.id} references missing collection ${campaign.collectionId}`)
    if (campaign.networkId && !networkIds.has(campaign.networkId)) errors.push(`Campaign ${campaign.id} references missing network ${campaign.networkId}`)
    if (campaign.mintCurrencyTokenId && !tokenIds.has(campaign.mintCurrencyTokenId)) errors.push(`Campaign ${campaign.id} references missing currency token ${campaign.mintCurrencyTokenId}`)
    const c = collectionById[campaign.collectionId]
    if (c && campaign.networkId && c.networkId !== campaign.networkId) errors.push(`Campaign ${campaign.id} network does not match collection ${c.id}`)
  }
  const creatorIds = new Set(creatorProfiles.map((item) => item.id))
  unique('creator', creatorProfiles.map((item) => item.id))
  unique('badge', badgeCatalog.map((item) => item.id))
  unique('artwork asset', artworkAssetCatalog.map((item) => item.id))
  for (const profile of ecosystemProfiles) {
    if (!networkIds.has(profile.id)) errors.push(`Ecosystem profile ${profile.id} has no network record`)
    profile.sampleCollectionIds.forEach((id) => { if (!collectionIds.has(id)) errors.push(`Ecosystem profile ${profile.id} references missing collection ${id}`) })
    profile.sampleProjectIds.forEach((id) => { if (!projectIds.has(id)) errors.push(`Ecosystem profile ${profile.id} references missing project ${id}`) })
  }
  for (const creator of creatorProfiles) {
    creator.collectionIds.forEach((id) => { if (!collectionIds.has(id)) errors.push(`Creator ${creator.id} references missing collection ${id}`) })
    creator.projectIds.forEach((id) => { if (!projectIds.has(id)) errors.push(`Creator ${creator.id} references missing project ${id}`) })
    creator.networkIds.forEach((id) => { if (!networkIds.has(id)) errors.push(`Creator ${creator.id} references missing network ${id}`) })
  }
  for (const collection of collections) if (collection.creatorId && !creatorIds.has(collection.creatorId)) errors.push(`Collection ${collection.id} references missing creator ${collection.creatorId}`)
  const badgeIds = new Set(badgeCatalog.map((item) => item.id))
  const entityBadgeRefs = [
    ...tokens.flatMap((item) => (item.badgeIds ?? []).map((id) => ({ entity: `token ${item.id}`, id }))),
    ...collections.flatMap((item) => (item.badgeIds ?? []).map((id) => ({ entity: `collection ${item.id}`, id }))),
    ...projects.flatMap((item) => (item.badgeIds ?? []).map((id) => ({ entity: `project ${item.id}`, id }))),
    ...campaigns.flatMap((item) => (item.badgeIds ?? []).map((id) => ({ entity: `campaign ${item.id}`, id }))),
    ...nftItems.flatMap((item) => (item.badgeIds ?? []).map((id) => ({ entity: `NFT ${item.id}`, id }))),
    ...marketplaceSellers.flatMap((item) => (item.badgeIds ?? []).map((id) => ({ entity: `seller ${item.id}`, id }))),
  ]
  for (const ref of entityBadgeRefs) if (!badgeIds.has(ref.id)) errors.push(`${ref.entity} references missing badge ${ref.id}`)
  for (const currency of currencyCatalog) {
    if (currency.tokenId && !tokenIds.has(currency.tokenId)) errors.push(`Currency ${currency.code} references missing token ${currency.tokenId}`)
    if (currency.networkId && !networkIds.has(currency.networkId)) errors.push(`Currency ${currency.code} references missing network ${currency.networkId}`)
  }
  return errors
}
export const NEXORA_DATA_VERSION = '1.2.0'
export const DATA_QUALITY_NOTE = 'All crypto/equity prices, volumes, holder counts, sales, NFT traits/rarity, rewards, airdrop eligibility, and campaign schedules are illustrative local demo data, not verified live market data. Network names, chain IDs, and documentation links are reference metadata; imported artwork licensing is not verified.'
/** Static product-level demo content shared by workspace screens. */
export type ActivityKind = 'collection' | 'token' | 'campaign' | 'watchlist'
export type ActivitySeed = { id: string; kind: ActivityKind; type: string; title: string; time: string; group: 'Today' | 'Earlier'; href: string; entityRef?: string }
export const activitySeeds: ActivitySeed[] = [
  { id: 'a1', kind: 'collection', type: 'Collection signal', title: 'Lumen Relics volume snapshot refreshed', time: '12 min ago', group: 'Today', href: '/collections/lumen-relics', entityRef: 'lumen-relics' },
  { id: 'a2', kind: 'token', type: 'Token movement', title: 'NEX demo quote moved +6.12%', time: '38 min ago', group: 'Today', href: '/tokens/nex', entityRef: 'nex' },
  { id: 'a3', kind: 'campaign', type: 'Campaign update', title: 'Second Eclipse marked as live in demo data', time: '2 hours ago', group: 'Today', href: '/drops', entityRef: 'second-eclipse' },
  { id: 'a4', kind: 'watchlist', type: 'Watchlist', title: 'Saved items loaded from this browser', time: 'Today', group: 'Today', href: '/watchlist' },
  { id: 'a5', kind: 'collection', type: 'Collection signal', title: 'Drift Avatars sample sales indexed', time: '3 hours ago', group: 'Today', href: '/collections/drift-avatars', entityRef: 'drift-avatars' },
  { id: 'a6', kind: 'campaign', type: 'Campaign update', title: 'Night Market: After Hours added to demo calendar', time: '4 hours ago', group: 'Today', href: '/drops', entityRef: 'night-market-opening' },
  { id: 'a7', kind: 'token', type: 'Token movement', title: 'JUP sample quote refreshed', time: 'Yesterday', group: 'Earlier', href: '/tokens/jup', entityRef: 'jup' },
  { id: 'a8', kind: 'collection', type: 'Collection signal', title: 'Nadir Studio edition history indexed', time: 'Yesterday', group: 'Earlier', href: '/collections/nadir-studio', entityRef: 'nadir-studio' },
  { id: 'a9', kind: 'token', type: 'Token movement', title: 'USDC shown as a stable quote reference', time: 'Yesterday', group: 'Earlier', href: '/tokens/usdc', entityRef: 'usdc' },
  { id: 'a10', kind: 'campaign', type: 'Campaign update', title: 'Relic Run scheduled in the demo calendar', time: '2 days ago', group: 'Earlier', href: '/drops', entityRef: 'ember-relic-run' },
  { id: 'a11', kind: 'watchlist', type: 'Watchlist', title: 'Watchlist stays on this device only', time: '2 days ago', group: 'Earlier', href: '/watchlist' },
  { id: 'a12', kind: 'collection', type: 'Collection signal', title: 'Nadir Studio added a new sample edition', time: '3 days ago', group: 'Earlier', href: '/collections/nadir-studio', entityRef: 'nadir-studio' },
]
export type NotificationSeed = { id: string; title: string; body: string; href: string; time: string; iconKey: 'watchlist' | 'campaign' | 'token' }
export const notificationSeeds: NotificationSeed[] = [
  { id: 'n1', title: 'Your watchlist is ready', body: 'Saved items are stored locally in this browser.', href: '/watchlist', time: 'Just now', iconKey: 'watchlist' },
  { id: 'n2', title: 'New campaign in the demo calendar', body: 'Review campaign status and sample timelines.', href: '/drops', time: '1 hour ago', iconKey: 'campaign' },
  { id: 'n3', title: 'Market data is illustrative', body: 'Token prices and percentage changes are not live.', href: '/tokens', time: 'Yesterday', iconKey: 'token' },
  { id: 'n4', title: 'New campaign added', body: 'Night Market: After Hours is marked upcoming in the demo calendar.', href: '/drops', time: 'Yesterday', iconKey: 'campaign' },
  { id: 'n5', title: 'Review your saved collections', body: 'Watchlist entries are stored locally in this browser.', href: '/watchlist', time: '2 days ago', iconKey: 'watchlist' },
  { id: 'n6', title: 'New token examples available', body: 'JUP, BONK, GMX, USDC and other sample assets are included.', href: '/tokens', time: '2 days ago', iconKey: 'token' },
  { id: 'n7', title: 'Airdrop safety reminder', body: 'Demo campaign cards do not prove eligibility or legitimacy.', href: '/help', time: '3 days ago', iconKey: 'campaign' },
  { id: 'n8', title: 'Explore the ecosystem atlas', body: 'Compare projects and collections grouped by network.', href: '/ecosystems', time: '3 days ago', iconKey: 'watchlist' },
]
export const rewardQuestSeeds = [
  { id: 'explore-collection', name: 'Explore a collection', points: 100, goal: 1, to: '/collections', completionRule: 'always-demo' as const },
  { id: 'save-three-tokens', name: 'Save three tokens', points: 150, goal: 3, to: '/tokens', completionRule: 'saved-tokens' as const },
  { id: 'read-safety-guide', name: 'Read the safety guide', points: 50, goal: 1, to: '/help', completionRule: 'manual-demo' as const },
  { id: 'compare-networks', name: 'Compare two networks', points: 75, goal: 2, to: '/ecosystems', completionRule: 'always-demo' as const },
  { id: 'inspect-an-nft', name: 'Inspect an NFT item', points: 80, goal: 1, to: '/collections', completionRule: 'always-demo' as const },
  { id: 'review-a-campaign', name: 'Review a demo campaign', points: 60, goal: 1, to: '/drops', completionRule: 'manual-demo' as const },
]
export const rewardSummarySeeds = [
  { label: 'Demo points', value: '2,450' },
  { label: 'Pending points', value: '180' },
  { label: 'Completed activities', value: '7' },
]
export const campaignStatusGroups = [
  { status: 'live' as const, title: 'Live now', hint: 'Marked live in the demo calendar' },
  { status: 'upcoming' as const, title: 'Upcoming', hint: 'Scheduled, not yet open' },
  { status: 'ended' as const, title: 'Ended', hint: 'Kept for reference' },
]

/**
 * Additional normalized product data for the wider NEXORA prototype.
 * All market figures and schedules below are fabricated demo fixtures.
 */
export type AirdropOpportunity = {
  id: string
  title: string
  projectId: string
  networkId: NetworkId
  campaignId?: string
  status: 'research' | 'upcoming' | 'live' | 'ended'
  rewardType: 'token' | 'nft' | 'points' | 'unknown'
  eligibilitySummary: string
  timingLabel: string
  riskLevel: 'low' | 'medium' | 'high' | 'unverified'
  cover: string
  disclaimer: string
  sourceType?: 'official' | 'research' | 'demo'
  sourceUrl?: string
  snapshotStatus?: 'unknown' | 'announced' | 'not-announced' | 'historical'
  claimStartAt?: string
  claimEndAt?: string
  rewardAssetTokenId?: string
  tasks?: string[]
  eligibilityConfidence?: 'unverified' | 'low' | 'medium' | 'high'
  lastReviewedAt?: string
  isIllustrative?: boolean
}

export const airdropOpportunities: AirdropOpportunity[] = [
  { id: 'drift-route-points', title: 'Route Explorer Points', projectId: 'drift-protocol', networkId: 'solana', campaignId: 'drift-wayfinder-season', status: 'upcoming', rewardType: 'points', eligibilitySummary: 'Demo checklist: explore the collection and review public project information.', timingLabel: 'Window not verified', riskLevel: 'unverified', cover: artworkFor('drift-avatars'), disclaimer: 'Fictional example. No eligibility or reward is promised.' },
  { id: 'lumen-chapter-pass', title: 'Chapter II Collector Pass', projectId: 'atelier-north', networkId: 'ethereum', campaignId: 'second-eclipse', status: 'live', rewardType: 'nft', eligibilitySummary: 'Demo condition: follow the campaign and inspect the featured collection.', timingLabel: 'Demo status: live', riskLevel: 'unverified', cover: artworkFor('lumen-relics'), disclaimer: 'Fictional example. Verify any real campaign using official project channels.' },
  { id: 'paper-moons-fold', title: 'Paper Moons Fold Points', projectId: 'kite', networkId: 'base', campaignId: 'chapter-iii', status: 'upcoming', rewardType: 'points', eligibilitySummary: 'Demo condition: browse the collection and read the campaign details.', timingLabel: 'Opens Oct 22 · demo schedule', riskLevel: 'unverified', cover: artworkFor('paper-moons'), disclaimer: 'Fictional example; the dates and points have no real-world value.' },
  { id: 'glasswardens-vault', title: 'Vault Opening Relic', projectId: 'glasswardens-studio', networkId: 'base', campaignId: 'vault-opening', status: 'live', rewardType: 'nft', eligibilitySummary: 'Demo condition: inspect sample items from Glasswardens.', timingLabel: 'Demo status: live', riskLevel: 'unverified', cover: artworkFor('glasswardens'), disclaimer: 'Fictional example. No claim transaction exists in this prototype.' },
  { id: 'night-market-access', title: 'After Hours Access Points', projectId: 'night-market-dao', networkId: 'solana', campaignId: 'night-market-opening', status: 'upcoming', rewardType: 'points', eligibilitySummary: 'Demo condition: review the membership collection and campaign safety notes.', timingLabel: 'Opens Oct 22 · demo schedule', riskLevel: 'unverified', cover: artworkFor('night-market'), disclaimer: 'Fictional example. Never pay a fee or reveal a seed phrase to claim a supposed airdrop.' },
  { id: 'copper-research-pass', title: 'Research Desk Pass', projectId: 'copper-dao', networkId: 'ethereum', campaignId: 'copper-signal-session', status: 'ended', rewardType: 'nft', eligibilitySummary: 'Archived sample membership campaign.', timingLabel: 'Ended · demo schedule', riskLevel: 'unverified', cover: artworkFor('copper-signal'), disclaimer: 'Fictional example, not an investment or membership offer.' },
  { id: 'nadir-color-points', title: 'Color Study Collector Points', projectId: 'nadir', networkId: 'polygon', campaignId: 'nadir-color-study', status: 'live', rewardType: 'points', eligibilitySummary: 'Demo condition: browse the art edition and read its collection details.', timingLabel: 'Demo status: live', riskLevel: 'unverified', cover: artworkFor('nadir-studio'), disclaimer: 'Fictional example. No points or assets can actually be claimed.' },
  { id: 'aether-reveal-research', title: 'Aether Reveal Watch', projectId: 'frame-office', networkId: 'arbitrum', status: 'research', rewardType: 'unknown', eligibilitySummary: 'Unconfirmed concept card for practicing safe campaign research; no reward or claim is announced.', timingLabel: 'Research only · no date', riskLevel: 'unverified', cover: artworkFor('aether-frames'), disclaimer: 'This is an invented placeholder, not an announced airdrop.' },
  { id: 'circuit-route-research', title: 'Circuit Route Research', projectId: 'circuit-atelier', networkId: 'solana', campaignId: 'circuit-after-dark', status: 'research', rewardType: 'unknown', eligibilitySummary: 'Fictional checklist example: review project details and learn to verify official links.', timingLabel: 'Research only · no confirmed window', riskLevel: 'unverified', cover: '/images/nexora/imported/neon-headset-avatar.jpg', disclaimer: 'Invented demo record. No real reward, eligibility, or claim is announced.' },
  { id: 'prism-creator-points', title: 'Prism Creator Points', projectId: 'prism-bureau', networkId: 'ethereum', campaignId: 'prism-signal-study', status: 'upcoming', rewardType: 'points', eligibilitySummary: 'Illustrative example for a future campaign-detail workflow; not a real points programme.', timingLabel: 'Demo schedule only', riskLevel: 'unverified', cover: '/images/nexora/imported/iridescent-sculpted-face.jpg', disclaimer: 'Fictional demo record. Verify real opportunities through official project channels.' },
  { id: 'relic-engine-watch', title: 'Relic Engine Watchlist Quest', projectId: 'forge-signal', networkId: 'avalanche', campaignId: 'relic-engine-awakening', status: 'upcoming', rewardType: 'nft', eligibilitySummary: 'Example record to demonstrate a campaign linked to a project, collection, and network.', timingLabel: 'Demo schedule only', riskLevel: 'unverified', cover: '/images/nexora/imported/magnetar-mech-core.jpg', disclaimer: 'Fictional sample; not an actual Avalanche airdrop.' },
]


for (const opportunity of airdropOpportunities) {
  opportunity.sourceType ??= 'demo'
  opportunity.snapshotStatus ??= opportunity.status === 'ended' ? 'historical' : 'unknown'
  opportunity.tasks ??= ['Review the project’s official channels', 'Check the network and collection references', 'Never share a seed phrase or pay an unsolicited claim fee']
  opportunity.eligibilityConfidence ??= 'unverified'
  opportunity.isIllustrative ??= true
  opportunity.lastReviewedAt ??= 'Not independently verified'
}

export type MarketplaceListing = {
  id: string
  nftId: string
  collectionId: string
  sellerId: string
  price: number
  currencyTokenId: string
  status: 'listed' | 'reserved' | 'sold'
  listedAtLabel: string
  marketplace?: string
  saleType?: 'fixed-price' | 'auction'
  expiresAtLabel?: string
  networkId?: NetworkId
  feeBps?: number
  creatorRoyaltyBps?: number
  isIllustrative?: boolean
}

export type MarketplaceSeller = { id: string; displayName: string; avatar: string; verified: boolean; reputationScore: number; joinedLabel: string; creatorId?: string; walletAddressMasked?: string; salesCount?: number; volumeTraded?: number; badgeIds?: string[]; isIllustrative?: boolean }
export const marketplaceSellers: MarketplaceSeller[] = [
  { id: 'collector-north-07', displayName: 'North Collector', avatar: '/images/nexora/white-anime-figure.jpg', verified: true, reputationScore: 98, joinedLabel: 'Joined 2024 · demo' },
  { id: 'atelier-vault-02', displayName: 'Atelier Vault', avatar: '/images/nexora/pop-art-mona-lisa.jpg', verified: true, reputationScore: 96, joinedLabel: 'Joined 2023 · demo' },
  { id: 'vesper-collector-11', displayName: 'Vesper Collector', avatar: '/images/nexora/dark-hooded-ape-avatar.jpg', verified: false, reputationScore: 88, joinedLabel: 'Joined 2025 · demo' },
  { id: 'wayfinder-042', displayName: 'Wayfinder 042', avatar: '/images/nexora/cyberpunk-colorful-avatar.jpg', verified: true, reputationScore: 94, joinedLabel: 'Joined 2024 · demo' },
  { id: 'orbit-collector-19', displayName: 'Orbit Collector', avatar: '/images/nexora/neon-rabbit-cyberpunk-avatar.jpg', verified: false, reputationScore: 85, joinedLabel: 'Joined 2025 · demo' },
  { id: 'kite-member-03', displayName: 'Kite Member', avatar: '/images/nexora/pixel-art-person-avatar.jpg', verified: false, reputationScore: 82, joinedLabel: 'Joined 2025 · demo' },
  { id: 'studio-archive-08', displayName: 'Studio Archive', avatar: '/images/nexora/imported/iridescent-crystal-portrait.jpg', verified: false, reputationScore: 89, joinedLabel: 'Joined 2024 · demo' },
  { id: 'night-owl-31', displayName: 'Night Owl', avatar: '/artwork/night-market-scrolls-2.svg', verified: false, reputationScore: 86, joinedLabel: 'Joined 2025 · demo' },
  { id: 'frame-office-05', displayName: 'Frame Office', avatar: '/images/nexora/anime-mascot-purple-background.jpg', verified: true, reputationScore: 95, joinedLabel: 'Joined 2023 · demo' },
  { id: 'signal-desk-14', displayName: 'Signal Desk', avatar: '/images/nexora/bitcoin-gold-orb.jpg', verified: true, reputationScore: 93, joinedLabel: 'Joined 2024 · demo' },
  { id: 'glasskeeper-09', displayName: 'Glasskeeper', avatar: '/images/nexora/glowing-eyed-panda-avatar.jpg', verified: false, reputationScore: 84, joinedLabel: 'Joined 2025 · demo' },
  { id: 'tideform-labs-02', displayName: 'Tideform Labs', avatar: '/artwork/tideform.svg', verified: true, reputationScore: 90, joinedLabel: 'Joined 2023 · demo' },
  { id: 'nadir-vault-03', displayName: 'Nadir Vault', avatar: '/images/nexora/red-background-ape-avatar.jpg', verified: false, reputationScore: 87, joinedLabel: 'Joined 2025 · demo' },
  { id: 'ember-runner-15', displayName: 'Ember Runner', avatar: '/images/nexora/minimal-white-astronaut-avatar.jpg', verified: true, reputationScore: 92, joinedLabel: 'Joined 2024 · demo' },
  { id: 'circuit-member-22', displayName: 'Circuit Member', avatar: '/images/nexora/imported/neon-headset-avatar.jpg', verified: false, reputationScore: 89, joinedLabel: 'Joined 2026 · demo' },
  { id: 'prism-collector-12', displayName: 'Prism Collector', avatar: '/images/nexora/imported/iridescent-sculpted-face.jpg', verified: false, reputationScore: 91, joinedLabel: 'Joined 2026 · demo' },
  { id: 'forge-vault-08', displayName: 'Forge Vault', avatar: '/images/nexora/imported/onyx-mech-mask.jpg', verified: false, reputationScore: 87, joinedLabel: 'Joined 2026 · demo' },
]

/** Small marketplace fixture set; every listing foreign key resolves to an NFT, collection and quote token. */
export const marketplaceListings: MarketplaceListing[] = [
  { id: 'listing-lumen-101', nftId: 'Lumen-1', collectionId: 'lumen-relics', sellerId: 'collector-north-07', price: 2.65, currencyTokenId: 'eth', status: 'listed', listedAtLabel: '12 min ago · demo' },
  { id: 'listing-lumen-104', nftId: 'Lumen-4', collectionId: 'lumen-relics', sellerId: 'atelier-vault-02', price: 2.92, currencyTokenId: 'eth', status: 'listed', listedAtLabel: '38 min ago · demo' },
  { id: 'listing-choir-101', nftId: 'Choir-1', collectionId: 'obsidian-choir', sellerId: 'vesper-collector-11', price: 1.18, currencyTokenId: 'eth', status: 'reserved', listedAtLabel: '1 hour ago · demo' },
  { id: 'listing-drift-101', nftId: 'Drift-1', collectionId: 'drift-avatars', sellerId: 'wayfinder-042', price: 49, currencyTokenId: 'sol', status: 'listed', listedAtLabel: '7 min ago · demo' },
  { id: 'listing-drift-103', nftId: 'Drift-3', collectionId: 'drift-avatars', sellerId: 'orbit-collector-19', price: 46, currencyTokenId: 'sol', status: 'listed', listedAtLabel: '26 min ago · demo' },
  { id: 'listing-moon-102', nftId: 'Moon-2', collectionId: 'paper-moons', sellerId: 'kite-member-03', price: 0.24, currencyTokenId: 'eth', status: 'listed', listedAtLabel: '54 min ago · demo' },
  { id: 'listing-scroll-101', nftId: 'Scroll-1', collectionId: 'night-market', sellerId: 'night-owl-31', price: 10.5, currencyTokenId: 'sol', status: 'sold', listedAtLabel: 'Yesterday · demo' },
  { id: 'listing-aether-102', nftId: 'Aether-2', collectionId: 'aether-frames', sellerId: 'frame-office-05', price: 0.59, currencyTokenId: 'eth', status: 'listed', listedAtLabel: '3 hours ago · demo' },
  { id: 'listing-signal-103', nftId: 'Signal-3', collectionId: 'copper-signal', sellerId: 'signal-desk-14', price: 4.85, currencyTokenId: 'eth', status: 'listed', listedAtLabel: '4 hours ago · demo' },
  { id: 'listing-warden-101', nftId: 'Warden-1', collectionId: 'glasswardens', sellerId: 'glasskeeper-09', price: 0.12, currencyTokenId: 'eth', status: 'reserved', listedAtLabel: 'Yesterday · demo' },
  { id: 'listing-tide-104', nftId: 'Tide-4', collectionId: 'tideform', sellerId: 'tideform-labs-02', price: 0.35, currencyTokenId: 'eth', status: 'listed', listedAtLabel: '5 hours ago · demo' },
  { id: 'listing-nadir-102', nftId: 'Nadir-2', collectionId: 'nadir-studio', sellerId: 'nadir-vault-03', price: 94, currencyTokenId: 'pol', status: 'listed', listedAtLabel: '6 hours ago · demo' },
  { id: 'listing-ember-104', nftId: 'Ember-4', collectionId: 'ember-archive', sellerId: 'ember-runner-15', price: 27, currencyTokenId: 'avax', status: 'listed', listedAtLabel: 'Yesterday · demo' },
  { id: 'listing-circuit-101', nftId: 'Circuit-1', collectionId: 'neon-circuit', sellerId: 'circuit-member-22', price: 19.2, currencyTokenId: 'sol', status: 'listed', listedAtLabel: '18 min ago · demo' },
  { id: 'listing-prism-102', nftId: 'Prism-2', collectionId: 'prism-archives', sellerId: 'prism-collector-12', price: 0.96, currencyTokenId: 'eth', status: 'listed', listedAtLabel: '32 min ago · demo' },
  { id: 'listing-relic-103', nftId: 'Relic-3', collectionId: 'relic-engines', sellerId: 'forge-vault-08', price: 14.1, currencyTokenId: 'avax', status: 'listed', listedAtLabel: '1 hour ago · demo' },
]


for (const seller of marketplaceSellers) {
  seller.walletAddressMasked ??= `0x••••••${seller.id.slice(-4)}`
  seller.salesCount ??= Math.max(3, Math.round(seller.reputationScore * 1.7))
  seller.volumeTraded ??= Number((seller.reputationScore * 1.43).toFixed(2))
  seller.badgeIds ??= seller.verified ? ['seller-profile-reviewed-demo'] : []
  seller.isIllustrative ??= true
}
for (const listing of marketplaceListings) {
  const parent = collectionById[listing.collectionId]
  listing.marketplace ??= 'NEXORA demo marketplace'
  listing.saleType ??= 'fixed-price'
  listing.expiresAtLabel ??= listing.status === 'sold' ? 'Closed' : 'No expiry · demo'
  listing.networkId ??= parent?.networkId
  listing.feeBps ??= 250
  listing.creatorRoyaltyBps ??= parent?.royaltyBps ?? 500
  listing.isIllustrative ??= true
}

export type EquityMarketSeed = {
  id: string
  ticker: string
  name: string
  kind: 'equity' | 'index'
  price: number
  change24h: number
  volumeLabel: string
  note: string
}

/** Optional traditional-market demo data for a future separate Markets screen; never mixed into crypto token lists. */
export const equityMarketSeeds: EquityMarketSeed[] = [
  { id: 'aapl', ticker: 'AAPL', name: 'Apple', kind: 'equity', price: 231.4, change24h: 0.62, volumeLabel: '42.1M shares', note: 'Illustrative fixture only; not a current quote.' },
  { id: 'nvda', ticker: 'NVDA', name: 'NVIDIA', kind: 'equity', price: 184.2, change24h: 1.18, volumeLabel: '118.4M shares', note: 'Illustrative fixture only; not a current quote.' },
  { id: 'tsla', ticker: 'TSLA', name: 'Tesla', kind: 'equity', price: 341.8, change24h: -1.34, volumeLabel: '76.8M shares', note: 'Illustrative fixture only; not a current quote.' },
  { id: 'msft', ticker: 'MSFT', name: 'Microsoft', kind: 'equity', price: 512.6, change24h: 0.41, volumeLabel: '19.7M shares', note: 'Illustrative fixture only; not a current quote.' },
  { id: 'spy', ticker: 'SPY', name: 'S&P 500 ETF', kind: 'index', price: 672.1, change24h: 0.28, volumeLabel: '54.2M shares', note: 'Illustrative fixture only; not a current quote.' },
  { id: 'qqq', ticker: 'QQQ', name: 'Nasdaq-100 ETF', kind: 'index', price: 603.7, change24h: 0.52, volumeLabel: '31.6M shares', note: 'Illustrative fixture only; not a current quote.' },
]

export const assistantPrompts = [
  'How do I find an NFT collection?',
  'What is an airdrop?',
  'Are token prices live?',
  'How do watchlists work?',
  'How do I compare networks?',
  'How can I spot a fake claim link?',
] as const

export const sidebarNavigation = [
  { label: 'Explore', links: [
    { to: '/discover', label: 'Discover', iconKey: 'compass' },
    { to: '/collections', label: 'Collections', iconKey: 'layers' },
    { to: '/tokens', label: 'Tokens', iconKey: 'coins' },
    { to: '/ecosystems', label: 'Ecosystems', iconKey: 'network' },
    { to: '/web3', label: 'Web3 Data Lab', iconKey: 'network' },
    { to: '/drops', label: 'Drops & Airdrops', iconKey: 'calendar' },
  ] },
  { label: 'Workspace', links: [
    { to: '/watchlist', label: 'Watchlist', iconKey: 'bookmark' },
    { to: '/activity', label: 'Activity', iconKey: 'activity' },
  ] },
  { label: 'Tools', links: [
    { to: '/tools', label: 'Web3 Tools', iconKey: 'wrench' },
    { to: '/assistant', label: 'AI Assistant', iconKey: 'bot' },
    { to: '/swap', label: 'Swap · Demo', iconKey: 'wallet' },
    { to: '/rewards', label: 'Rewards · Demo', iconKey: 'gift' },
  ] },
  { label: 'Account', links: [
    { to: '/profile', label: 'Profile', iconKey: 'user' },
    { to: '/settings', label: 'Settings', iconKey: 'settings' },
    { to: '/notifications', label: 'Notifications', iconKey: 'bell' },
    { to: '/help', label: 'Help & Resources', iconKey: 'help' },
  ] },
] as const

export const globalSearchPages = [
  { id: 'p-discover', group: 'Go to', title: 'Discover', meta: 'Overview and trending', path: '/discover', iconKey: 'compass' },
  { id: 'p-collections', group: 'Go to', title: 'Collections', meta: 'Browse digital collectibles', path: '/collections', iconKey: 'layers' },
  { id: 'p-tokens', group: 'Go to', title: 'Tokens', meta: 'Ranked demo quotes', path: '/tokens', iconKey: 'coins' },
  { id: 'p-web3', group: 'Go to', title: 'Web3 Data Lab', meta: 'RPC health, IPFS and identity foundation', path: '/web3', iconKey: 'network' },
  { id: 'p-watchlist', group: 'Go to', title: 'Watchlist', meta: 'Your saved items', path: '/watchlist', iconKey: 'bookmark' },
  { id: 'p-drops', group: 'Go to', title: 'Drops & Airdrops', meta: 'Upcoming and live campaigns', path: '/drops', iconKey: 'calendar' },
  { id: 'p-settings', group: 'Go to', title: 'Settings', meta: 'Motion, density and preferences', path: '/settings', iconKey: 'settings' },
] as const

export const helpCategorySeeds = [
  { id: 'start', label: 'Getting started', blurb: 'What NEXORA is, and what it deliberately is not.', tone: 'text-copper' },
  { id: 'safety', label: 'Wallet safety', blurb: 'Habits that protect keys, funds, and attention.', tone: 'text-gain' },
  { id: 'markets', label: 'Markets & data', blurb: 'Reading tokens, collections, and campaigns.', tone: 'text-sage' },
  { id: 'tools', label: 'Tools & simulators', blurb: 'Local utilities, the swap sandbox, and the assistant.', tone: 'text-ember' },
] as const

export type HelpCategoryId = 'start' | 'safety' | 'markets' | 'tools'
export type HelpArticleSeed = { id: string; category: HelpCategoryId; title: string; summary: string; body: string[]; tags: string[]; read: string; link?: { to: string; label: string } }
export const helpArticles: HelpArticleSeed[] = [
  { id: 'prototype', category: 'start', title: 'What is this prototype?', summary: 'A frontend exploration workspace running on a local sample catalog.', read: '2 min', tags: ['demo', 'overview', 'sample data'],
    body: ['NEXORA is a frontend exploration workspace using a local sample catalog. It does not connect to wallets, exchanges, or blockchain indexers.', 'Prices, volumes, owners, and activity are fictional and illustrative. Nothing here is financial advice or a real listing.'] },
  { id: 'navigate', category: 'start', title: 'Finding your way around', summary: 'Sidebar sections, global search, and where your saved items live.', read: '3 min', tags: ['navigation', 'search', 'sidebar'],
    body: ['Use the sidebar to move between Discover, Collections, Tokens, Ecosystems, Drops, Activity, and the utility workspaces.', 'The global search in the top bar finds tokens and collections across the sample catalog.'], link: { to: '/discover', label: 'Open Discover' } },
  { id: 'watchlist', category: 'start', title: 'How do watchlists work?', summary: 'Bookmark tokens and collections and keep them in this browser.', read: '2 min', tags: ['watchlist', 'bookmark', 'storage'],
    body: ['Use the bookmark controls on tokens and collections. Your choices persist in browser storage and can be cleared by removing items.', 'Because storage is local, your watchlist does not follow you to another browser or device.'], link: { to: '/watchlist', label: 'Open Watchlist' } },
  { id: 'seed', category: 'safety', title: 'Never share your seed phrase', summary: 'Why no legitimate support agent ever needs your keys.', read: '3 min', tags: ['seed phrase', 'private key', 'scam', 'support'],
    body: ['Never share your seed phrase or private key. A legitimate support agent does not need them.', 'Treat any request for recovery words — via chat, email, a form, or a video call — as a scam, however official it looks.'] },
  { id: 'domains', category: 'safety', title: 'Check domains before connecting', summary: 'Spot lookalike sites, fake mints, and cloned dashboards.', read: '4 min', tags: ['domain', 'phishing', 'wallet connect', 'links'],
    body: ['Check domains before connecting a wallet. Type addresses yourself or use a bookmark you made earlier rather than following links from messages.', 'Lookalike domains often swap a letter, add a hyphen, or use an unfamiliar extension. When something feels urgent, slow down.'], link: { to: '/tools', label: 'Open address inspector' } },
  { id: 'airdrop', category: 'safety', title: 'What is an airdrop?', summary: 'How distributions work, and how impersonators exploit them.', read: '3 min', tags: ['airdrop', 'drops', 'campaign', 'scam'],
    body: ['An airdrop is a distribution of tokens or digital assets. Real campaigns can be impersonated by scammers; verify announcements through official project channels.', 'Listings on the Drops page are fictional and are not endorsements or eligibility guarantees.'], link: { to: '/drops', label: 'Browse Drops' } },
  { id: 'tokens', category: 'markets', title: 'Reading a token page', summary: 'Price, change, volume, and what the sparkline does and does not say.', read: '4 min', tags: ['tokens', 'price', 'volume', 'sparkline'],
    body: ['Token pages show a quoted price, percentage change, and a compact trend line built from sample data.', 'A short trend line is context, not a prediction. Compare volume and change together before drawing conclusions.'], link: { to: '/tokens', label: 'Browse Tokens' } },
  { id: 'collections', category: 'markets', title: 'Understanding collection floors', summary: 'Floor price, items, owners, and why the floor is only one signal.', read: '3 min', tags: ['collections', 'floor', 'nft', 'owners'],
    body: ['The floor is the lowest sample listing price for a collection. It can move sharply when a few items change hands.', 'Look at owner count, item count, and 24h volume alongside the floor.'], link: { to: '/collections', label: 'Browse Collections' } },
  { id: 'ecosystems', category: 'markets', title: 'Comparing ecosystems', summary: 'Networks differ in fees, finality, and tooling.', read: '3 min', tags: ['networks', 'ecosystems', 'chains'],
    body: ['Each network in the atlas groups its sample projects, tokens, and collections.', 'The atlas is a way to orient yourself — it does not rank networks or recommend one.'], link: { to: '/ecosystems', label: 'Open Ecosystems' } },
  { id: 'swap', category: 'tools', title: 'Using the swap simulator', summary: 'Preview a fictional exchange with no wallet and no transaction.', read: '2 min', tags: ['swap', 'simulator', 'sandbox'],
    body: ['The simulator previews a fictional token exchange using sample prices.', 'No wallet is connected and no blockchain transaction is ever created.'], link: { to: '/swap', label: 'Open Swap' } },
  { id: 'inspector', category: 'tools', title: 'Address inspector & unit converter', summary: 'Check address formats and convert wei, gwei, and ETH locally.', read: '2 min', tags: ['address', 'wei', 'gwei', 'converter', 'tools'],
    body: ['The inspector validates the format of EVM and Solana-style addresses. A matching format does not prove an address is safe or owned by anyone.', 'Everything runs in your browser with no network request.'], link: { to: '/tools', label: 'Open Tools' } },
  { id: 'assistant', category: 'tools', title: 'What the assistant can do', summary: 'Scripted local replies for navigating the demo.', read: '2 min', tags: ['assistant', 'ai', 'chat'],
    body: ['The assistant gives scripted local responses. It does not query live chains or an AI service.', 'Try asking about tokens, collections, airdrops, or watchlists.'], link: { to: '/assistant', label: 'Open Assistant' } },
]

export const helpFaqSeeds = [
  { q: 'Does NEXORA connect to my wallet?', a: 'No. This prototype has no wallet connection, exchange link, or blockchain indexer. All data comes from a local sample catalog.' },
  { q: 'Is any of the data real?', a: 'No. Prices, floors, volumes, campaigns, and events are fictional and illustrative. Do not use them to make financial decisions.' },
  { q: 'Where are my watchlist and settings stored?', a: 'In this browser only, using local storage. Clearing site data removes them, and they do not sync between devices.' },
  { q: 'How can I tell a real airdrop from a scam?', a: 'Verify through the project’s official channels, never connect a wallet from an unsolicited link, and remember that real claims never require your seed phrase.' },
  { q: 'Can I talk to a support agent?', a: 'Not in this prototype. There is no live chat or ticketing backend. The support panel below is a demo layout only.' },
  { q: 'Can I reduce animations?', a: 'Yes. Open Settings and turn on reduced motion. NEXORA also respects your operating system’s reduced-motion preference.' },
] as const

export const helpReadingSeeds = [
  { label: 'Ethereum.org learning', note: 'Foundations of Ethereum, wallets, and security.', href: 'https://ethereum.org/en/learn/' },
  { label: 'Solana documentation', note: 'Concepts, tooling, and developer guides.', href: 'https://solana.com/docs' },
  { label: 'Base docs', note: 'Developer guides and ecosystem concepts for Base.', href: 'https://docs.base.org/' },
  { label: 'Polygon docs', note: 'Network and developer documentation for Polygon.', href: 'https://docs.polygon.technology/' },
] as const

export function validateExtendedDataIntegrity(): string[] {
  const errors: string[] = []
  const allNfts = nftItems
  const nftIds = new Set(allNfts.map((item) => item.id))
  const collectionIds = new Set(collections.map((item) => item.id))
  const projectIds = new Set(projects.map((item) => item.id))
  const campaignIds = new Set(campaigns.map((item) => item.id))
  const networkIds = new Set(networks.map((item) => item.id))
  const tokenIds = new Set(tokens.map((item) => item.id))
  const sellerIds = new Set(marketplaceSellers.map((item) => item.id))
  const uniqueCheck = (kind: string, ids: string[]) => {
    const seen = new Set<string>()
    ids.forEach((id) => { if (seen.has(id)) errors.push(`Duplicate ${kind} id: ${id}`); seen.add(id) })
  }
  uniqueCheck('seller', marketplaceSellers.map((item) => item.id))
  uniqueCheck('airdrop', airdropOpportunities.map((item) => item.id))
  uniqueCheck('listing', marketplaceListings.map((item) => item.id))
  for (const drop of airdropOpportunities) {
    if (!projectIds.has(drop.projectId)) errors.push(`Airdrop ${drop.id} references missing project ${drop.projectId}`)
    if (!networkIds.has(drop.networkId)) errors.push(`Airdrop ${drop.id} references missing network ${drop.networkId}`)
    if (drop.campaignId && !campaignIds.has(drop.campaignId)) errors.push(`Airdrop ${drop.id} references missing campaign ${drop.campaignId}`)
    const linkedProject = projectById[drop.projectId]
    if (linkedProject && linkedProject.networkId !== drop.networkId) errors.push(`Airdrop ${drop.id} network does not match project ${drop.projectId}`)
    if (drop.campaignId && linkedProject) {
      const linkedCampaign = campaignById[drop.campaignId]
      if (linkedCampaign && linkedProject.collectionId && linkedCampaign.collectionId !== linkedProject.collectionId) errors.push(`Airdrop ${drop.id} project and campaign reference different collections`)
    }
  }
  for (const listing of marketplaceListings) {
    if (!nftIds.has(listing.nftId)) errors.push(`Listing ${listing.id} references missing NFT ${listing.nftId}`)
    if (!collectionIds.has(listing.collectionId)) errors.push(`Listing ${listing.id} references missing collection ${listing.collectionId}`)
    if (!tokenIds.has(listing.currencyTokenId)) errors.push(`Listing ${listing.id} references missing currency token ${listing.currencyTokenId}`)
    if (!sellerIds.has(listing.sellerId)) errors.push(`Listing ${listing.id} references missing seller ${listing.sellerId}`)
    const nft = allNfts.find((item) => item.id === listing.nftId)
    if (nft && nft.collectionId !== listing.collectionId) errors.push(`Listing ${listing.id} NFT/collection relationship does not match`)
    const collection = collectionById[listing.collectionId]
    if (collection && collection.linkedTokenId !== listing.currencyTokenId) errors.push(`Listing ${listing.id} currency does not match collection quote token`)
  }
  return errors
}
export const EXTENDED_DATA_INTEGRITY_ERRORS = validateExtendedDataIntegrity()
if (EXTENDED_DATA_INTEGRITY_ERRORS.length > 0) console.error('[NEXORA extended data integrity]', EXTENDED_DATA_INTEGRITY_ERRORS)

/** Cross-feature metadata registries for future UI functionality. These are local demo/reference records. */
export type BadgeDefinition = { id: string; label: string; description: string; tone: 'violet' | 'cyan' | 'green' | 'amber' | 'red' | 'neutral'; appliesTo: ('collection' | 'nft' | 'project' | 'campaign' | 'airdrop' | 'token' | 'seller')[] }
export const badgeCatalog: BadgeDefinition[] = [
  { id: 'featured', label: 'Featured', description: 'Selected for a curated placement in the demo UI.', tone: 'violet', appliesTo: ['collection', 'project', 'campaign'] },
  { id: 'new-series', label: 'New series', description: 'A newly added fictional catalog series.', tone: 'cyan', appliesTo: ['collection', 'project', 'campaign'] },
  { id: 'limited-edition', label: 'Limited edition', description: 'Demo metadata flag; does not establish on-chain scarcity.', tone: 'amber', appliesTo: ['nft', 'collection'] },
  { id: 'rare-trait', label: 'Rare trait', description: 'Illustrative rarity label generated for the prototype.', tone: 'violet', appliesTo: ['nft'] },
  { id: 'generative', label: 'Generative', description: 'Artwork category label for generative-art records.', tone: 'cyan', appliesTo: ['collection', 'project', 'nft'] },
  { id: 'game-ready', label: 'Game world', description: 'Fictional collection is framed for game-world concepts.', tone: 'green', appliesTo: ['collection', 'project', 'nft'] },
  { id: 'live', label: 'Live in demo', description: 'Campaign status in local sample data only.', tone: 'green', appliesTo: ['campaign', 'airdrop'] },
  { id: 'upcoming', label: 'Upcoming', description: 'Campaign is marked upcoming in the sample calendar.', tone: 'amber', appliesTo: ['campaign', 'airdrop'] },
  { id: 'research-only', label: 'Research only', description: 'Unconfirmed opportunity shown for education and UI testing.', tone: 'neutral', appliesTo: ['airdrop'] },
  { id: 'stable-reference', label: 'Stable reference', description: 'Stablecoin example; demo price is fixed and not a live quote.', tone: 'green', appliesTo: ['token'] },
  { id: 'demo-asset', label: 'Demo asset', description: 'Fictional asset used only to populate the NEXORA prototype.', tone: 'neutral', appliesTo: ['token'] },
  { id: 'seller-profile-reviewed-demo', label: 'Seller profile', description: 'Local demo profile with sample reputation fields; not identity verified.', tone: 'neutral', appliesTo: ['seller'] },
]

export type CurrencyDefinition = { id: string; code: string; name: string; symbol: string; kind: 'fiat' | 'crypto'; decimals: number; tokenId?: string; networkId?: NetworkId; note: string }
export const currencyCatalog: CurrencyDefinition[] = [
  { id: 'currency-usd', code: 'USD', name: 'US Dollar', symbol: '$', kind: 'fiat', decimals: 2, note: 'Display currency for illustrative conversions only.' },
  { id: 'currency-eth', code: 'ETH', name: 'Ether', symbol: 'Ξ', kind: 'crypto', decimals: 18, tokenId: 'eth', networkId: 'ethereum', note: 'Used as a quote unit across Ethereum and selected EVM L2 examples; this is not a claim about token deployment.' },
  { id: 'currency-sol', code: 'SOL', name: 'Solana', symbol: '◎', kind: 'crypto', decimals: 9, tokenId: 'sol', networkId: 'solana', note: 'Native SOL quote unit in demo records.' },
  { id: 'currency-pol', code: 'POL', name: 'POL', symbol: 'POL', kind: 'crypto', decimals: 18, tokenId: 'pol', networkId: 'polygon', note: 'Polygon token quote unit in demo records.' },
  { id: 'currency-avax', code: 'AVAX', name: 'Avalanche', symbol: 'AVAX', kind: 'crypto', decimals: 18, tokenId: 'avax', networkId: 'avalanche', note: 'Native AVAX quote unit in demo records.' },
  { id: 'currency-usdc', code: 'USDC', name: 'USD Coin', symbol: 'USDC', kind: 'crypto', decimals: 6, tokenId: 'usdc', networkId: 'ethereum', note: 'Stablecoin reference; price is fixed to $1 in this illustrative fixture.' },
]

export type EcosystemProfile = { id: NetworkId; layer: 'L1' | 'L2'; summary: string; strengths: string[]; nativeCurrencyCode: string; docsUrl: string; explorerUrl?: string; cover?: string; sampleProjectIds: string[]; sampleCollectionIds: string[]; dataStatus: 'reference-metadata-plus-demo-catalog' }
export const ecosystemProfiles: EcosystemProfile[] = [
  { id: 'ethereum', layer: 'L1', cover: '/images/nexora/imported/blockchain-network-illustration.jpg', summary: 'General-purpose smart-contract network with a broad decentralized application ecosystem.', strengths: ['Smart contracts', 'Large developer ecosystem', 'EVM tooling'], nativeCurrencyCode: 'ETH', docsUrl: 'https://ethereum.org/developers/', explorerUrl: 'https://etherscan.io/', sampleProjectIds: ['atelier-north', 'vesper-lab', 'copper-dao', 'prism-bureau'], sampleCollectionIds: ['lumen-relics', 'obsidian-choir', 'copper-signal', 'prism-archives'], dataStatus: 'reference-metadata-plus-demo-catalog' },
  { id: 'solana', layer: 'L1', cover: '/images/nexora/imported/ai-network-orb-illustration.jpg', summary: 'Layer 1 designed for high-throughput applications and low-latency interactions.', strengths: ['High throughput', 'NFT and consumer apps', 'Low transaction costs'], nativeCurrencyCode: 'SOL', docsUrl: 'https://solana.com/docs', explorerUrl: 'https://solscan.io/', sampleProjectIds: ['drift-protocol', 'night-market-dao', 'circuit-atelier'], sampleCollectionIds: ['drift-avatars', 'night-market', 'neon-circuit'], dataStatus: 'reference-metadata-plus-demo-catalog' },
  { id: 'base', layer: 'L2', cover: '/images/nexora/imported/violet-blockchain-nodes.jpg', summary: 'Ethereum Layer 2 using the OP Stack, with ETH as the gas asset.', strengths: ['Ethereum-aligned tooling', 'Consumer applications', 'Lower fees than L1 in typical conditions'], nativeCurrencyCode: 'ETH', docsUrl: 'https://docs.base.org/', explorerUrl: 'https://basescan.org/', sampleProjectIds: ['kite', 'glasswardens-studio'], sampleCollectionIds: ['paper-moons', 'glasswardens'], dataStatus: 'reference-metadata-plus-demo-catalog' },
  { id: 'polygon', layer: 'L2', cover: '/images/nexora/imported/blockchain-blocks-illustration.jpg', summary: 'EVM-compatible network in the Polygon ecosystem.', strengths: ['EVM compatibility', 'Consumer and gaming apps', 'Established tooling'], nativeCurrencyCode: 'POL', docsUrl: 'https://docs.polygon.technology/', explorerUrl: 'https://polygonscan.com/', sampleProjectIds: ['nadir'], sampleCollectionIds: ['nadir-studio'], dataStatus: 'reference-metadata-plus-demo-catalog' },
  { id: 'arbitrum', layer: 'L2', cover: '/images/nexora/imported/purple-digital-ledger-illustration.jpg', summary: 'Ethereum Layer 2 rollup ecosystem with EVM compatibility.', strengths: ['EVM compatibility', 'DeFi ecosystem', 'Ethereum settlement'], nativeCurrencyCode: 'ETH', docsUrl: 'https://docs.arbitrum.io/', explorerUrl: 'https://arbiscan.io/', sampleProjectIds: ['tideform-labs', 'frame-office'], sampleCollectionIds: ['tideform', 'aether-frames'], dataStatus: 'reference-metadata-plus-demo-catalog' },
  { id: 'avalanche', layer: 'L1', cover: '/images/nexora/imported/blockchain-game-world-scene.jpg', summary: 'EVM-compatible Layer 1 network with application-specific chain tooling.', strengths: ['EVM compatibility', 'Application-specific chains', 'Gaming use cases'], nativeCurrencyCode: 'AVAX', docsUrl: 'https://build.avax.network/docs', sampleProjectIds: ['ember', 'forge-signal'], sampleCollectionIds: ['ember-archive', 'relic-engines'], dataStatus: 'reference-metadata-plus-demo-catalog' },
  { id: 'optimism', layer: 'L2', cover: '/images/nexora/imported/secure-blockchain-network.jpg', summary: 'Ethereum Layer 2 and OP Stack ecosystem; ETH is used for gas while OP is a governance token.', strengths: ['Ethereum scaling', 'OP Stack ecosystem', 'EVM tooling'], nativeCurrencyCode: 'ETH', docsUrl: 'https://docs.optimism.io/', explorerUrl: 'https://optimistic.etherscan.io/', sampleProjectIds: [], sampleCollectionIds: [], dataStatus: 'reference-metadata-plus-demo-catalog' },
]

export type CreatorProfile = { id: string; name: string; kind: 'studio' | 'dao' | 'protocol' | 'fictional-studio'; bio: string; avatar: string; networkIds: NetworkId[]; collectionIds: string[]; projectIds: string[]; links: { label: string; href: string; status: 'official-reference' | 'demo-placeholder' }[]; verificationStatus: 'unverified' | 'demo-only' }
export const creatorProfiles: CreatorProfile[] = [
  { id: 'atelier-north', name: 'Atelier North', kind: 'fictional-studio', bio: 'Sculptural light studies and carefully sequenced digital editions.', avatar: '/images/nexora/imported/iridescent-crystal-portrait.jpg', networkIds: ['ethereum'], collectionIds: ['lumen-relics'], projectIds: ['atelier-north'], links: [], verificationStatus: 'demo-only' },
  { id: 'vesper-lab', name: 'Vesper Lab', kind: 'fictional-studio', bio: 'Dark mineral portraits composed as a collective visual score.', avatar: '/images/nexora/imported/black-orbit-figure.jpg', networkIds: ['ethereum'], collectionIds: ['obsidian-choir'], projectIds: ['vesper-lab'], links: [], verificationStatus: 'demo-only' },
  { id: 'drift-protocol', name: 'Drift Protocol', kind: 'protocol', bio: 'Real project name used as a demo inspiration reference; this catalog does not assert affiliation or partnership.', avatar: '/images/nexora/imported/cyberpunk-pilot-portrait.jpg', networkIds: ['solana'], collectionIds: ['drift-avatars'], projectIds: ['drift-protocol'], links: [{ label: 'Official site', href: 'https://www.drift.trade/', status: 'official-reference' }], verificationStatus: 'unverified' },
  { id: 'kite-studio', name: 'Kite Studio', kind: 'fictional-studio', bio: 'Paper, moons, and very slow mint calendars.', avatar: '/images/nexora/imported/pastel-cat-avatar.jpg', networkIds: ['base'], collectionIds: ['paper-moons'], projectIds: ['kite'], links: [], verificationStatus: 'demo-only' },
  { id: 'circuit-atelier', name: 'Circuit Atelier', kind: 'fictional-studio', bio: 'Avatar studies from a fictional after-dark network.', avatar: '/images/nexora/imported/neon-headset-avatar.jpg', networkIds: ['solana'], collectionIds: ['neon-circuit'], projectIds: ['circuit-atelier'], links: [], verificationStatus: 'demo-only' },
  { id: 'prism-bureau', name: 'Prism Bureau', kind: 'fictional-studio', bio: 'Generative portraiture, fragmented light, and signal noise.', avatar: '/images/nexora/imported/iridescent-sculpted-face.jpg', networkIds: ['ethereum'], collectionIds: ['prism-archives'], projectIds: ['prism-bureau'], links: [], verificationStatus: 'demo-only' },
  { id: 'forge-signal', name: 'Forge Signal', kind: 'fictional-studio', bio: 'A fictional archive of relics and machine guardians.', avatar: '/images/nexora/imported/magnetar-mech-core.jpg', networkIds: ['avalanche'], collectionIds: ['relic-engines'], projectIds: ['forge-signal'], links: [], verificationStatus: 'demo-only' },
  { id: 'night-market-dao', name: 'Night Market DAO', kind: 'dao', bio: 'Fictional community for after-hours access passes and digital keepsakes.', avatar: '/images/nexora/imported/neon-vr-streetwear-portrait.jpg', networkIds: ['solana'], collectionIds: ['night-market'], projectIds: ['night-market-dao'], links: [], verificationStatus: 'demo-only' },
  { id: 'frame-office', name: 'Frame Office', kind: 'fictional-studio', bio: 'Minimal frames, color studies, and generative art experiments.', avatar: '/images/nexora/imported/glitch-fusion-portrait.jpg', networkIds: ['arbitrum'], collectionIds: ['aether-frames'], projectIds: ['frame-office'], links: [], verificationStatus: 'demo-only' },
  { id: 'copper-dao', name: 'Copper Signal DAO', kind: 'dao', bio: 'Fictional research membership desk for signal-focused market studies.', avatar: '/images/nexora/imported/ai-network-orb-illustration.jpg', networkIds: ['ethereum'], collectionIds: ['copper-signal'], projectIds: ['copper-dao'], links: [], verificationStatus: 'demo-only' },
  { id: 'glasswardens-studio', name: 'Glasswardens Studio', kind: 'fictional-studio', bio: 'Playable guardians and artifacts from a fictional glass-city world.', avatar: '/images/nexora/imported/storm-eye-crystal-orb.jpg', networkIds: ['base'], collectionIds: ['glasswardens'], projectIds: ['glasswardens-studio'], links: [], verificationStatus: 'demo-only' },
  { id: 'tideform-labs', name: 'Tideform Labs', kind: 'fictional-studio', bio: 'Coastal survey artwork and a fictional ocean-inspired game world.', avatar: '/artwork/tideform.svg', networkIds: ['arbitrum'], collectionIds: ['tideform'], projectIds: ['tideform-labs'], links: [], verificationStatus: 'demo-only' },
  { id: 'nadir', name: 'Nadir Studio', kind: 'fictional-studio', bio: 'Small-run art editions with expressive color and character.', avatar: '/images/nexora/imported/cosmic-girl-avatar.jpg', networkIds: ['polygon'], collectionIds: ['nadir-studio'], projectIds: ['nadir'], links: [], verificationStatus: 'demo-only' },
  { id: 'ember', name: 'Ember Archive', kind: 'fictional-studio', bio: 'Turn-based relics, stored like museum inventory.', avatar: '/images/nexora/imported/dark-relic-keeper.jpg', networkIds: ['avalanche'], collectionIds: ['ember-archive'], projectIds: ['ember'], links: [], verificationStatus: 'demo-only' },
]

export const artworkAssetCatalog = artworkAssets
export const artworkAssetById = Object.fromEntries(artworkAssets.map((asset) => [asset.id, asset]))

export const CATALOG_INTEGRITY_ERRORS = validateCatalogIntegrity()
if (CATALOG_INTEGRITY_ERRORS.length > 0) console.error('[NEXORA catalog integrity]', CATALOG_INTEGRITY_ERRORS)

export function validateArtworkManifest(): string[] {
  const errors: string[] = []
  const seenIds = new Set<string>()
  const seenPaths = new Set<string>()
  for (const asset of artworkAssetCatalog) {
    if (seenIds.has(asset.id)) errors.push(`Duplicate artwork asset id: ${asset.id}`)
    if (seenPaths.has(asset.path)) errors.push(`Duplicate artwork asset path: ${asset.path}`)
    seenIds.add(asset.id); seenPaths.add(asset.path)
    if (!asset.path.startsWith('/images/nexora/imported/')) errors.push(`Unexpected imported asset path: ${asset.path}`)
  }
  return errors
}
export const ARTWORK_MANIFEST_ERRORS = validateArtworkManifest()
if (ARTWORK_MANIFEST_ERRORS.length > 0) console.error('[NEXORA artwork manifest]', ARTWORK_MANIFEST_ERRORS)

/** Canonical normalized view for new screens and integrations. */
export const normalizedCatalog = {
  networks,
  tokens,
  collections: collections.map(({ id, slug, name, networkId, category, floor, floorSymbol, volume24h, items, owners, cover, banner, description, creator, linkedTokenId, badgeIds, tags, standard, royaltyBps, verificationStatus, creatorId, mintStatus, supplyDescription, marketContext }) => ({ id, slug, name, networkId, category, floor, floorSymbol, volume24h, items, owners, cover, banner, description, creator, linkedTokenId, badgeIds, tags, standard, royaltyBps, verificationStatus, creatorId, mintStatus, supplyDescription, marketContext })),
  nftItems,
  projects,
  campaigns,
  activitySeeds,
  notificationSeeds,
  rewardQuestSeeds,
  rewardSummarySeeds,
  airdropOpportunities,
  marketplaceListings,
  marketplaceSellers,
  equityMarketSeeds,
  assistantPrompts,
  sidebarNavigation,
  globalSearchPages,
  helpFaqSeeds,
  helpReadingSeeds,
  helpCategorySeeds,
  helpArticles,
  collectionCategories,
  badgeCatalog,
  currencyCatalog,
  ecosystemProfiles,
  creatorProfiles,
  artworkAssetCatalog,
  artworkAssetById,
  ARTWORK_MANIFEST_ERRORS,
} as const

// Domain aliases used by screens that call campaigns "drops" or tokens "market assets".
export const drops = campaigns
export const marketAssets = tokens
