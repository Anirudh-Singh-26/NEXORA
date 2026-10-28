/**
 * Local artwork mapping for the 22 catalog tokens.
 * The files live in public/images/Tokens_new and are supplied with the project.
 * Keep this mapping explicit so rail cards and every TokenGlyph instance stay in sync.
 */
const tokenImageById: Record<string, string> = {
  nex: '/images/Tokens_new/Token1.avif',
  eth: '/images/Tokens_new/Token2.avif',
  sol: '/images/Tokens_new/Token3.avif',
  btc: '/images/Tokens_new/Token4.avif',
  arb: '/images/Tokens_new/Token5.avif',
  avax: '/images/Tokens_new/Token6.avif',
  pol: '/images/Tokens_new/Token7.avif',
  link: '/images/Tokens_new/Token8.avif',
  uni: '/images/Tokens_new/Token9.avif',
  aave: '/images/Tokens_new/Token10.avif',
  op: '/images/Tokens_new/Token11.avif',
  tia: '/images/Tokens_new/Token12.avif',
  sui: '/images/Tokens_new/Token13.avif',
  rnd: '/images/Tokens_new/Token14.avif',
  usdc: '/images/Tokens_new/Token15.avif',
  jup: '/images/Tokens_new/Token16.avif',
  bonk: '/images/Tokens_new/Token17.avif',
  gmx: '/images/Tokens_new/Token18.avif',
  wbtc: '/images/Tokens_new/Token19.avif',
  render: '/images/Tokens_new/Token20.avif',
  zora: '/images/Tokens_new/Token21.avif',
  gala: '/images/Tokens_new/Token22.avif',
}

export function getTokenImage(id: string): string | undefined {
  return tokenImageById[id.toLowerCase()]
}
