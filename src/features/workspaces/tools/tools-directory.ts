export type ToolId = 'address' | 'converter' | 'lookup'
export type ToolCategory = 'Address utilities' | 'Conversion' | 'Reference'

export type ToolMeta = {
  id: ToolId
  title: string
  category: ToolCategory
  summary: string
  input: string
  output: string
  badge: string
  keywords: string[]
}

/** The tools this workspace actually ships. Add an entry here when a tool is added to tools.tsx. */
export const TOOLS: ToolMeta[] = [
  {
    id: 'address',
    title: 'Address inspector',
    category: 'Address utilities',
    summary: 'Checks basic EVM (0x + 40 hex characters) or Solana (base58-like, 32–44 characters) formatting only. It does not verify balances or ownership.',
    input: 'A public address',
    output: 'Format verdict and a hint',
    badge: 'Format only',
    keywords: ['evm', 'solana', '0x', 'base58', 'validate', 'wallet', 'format'],
  },
  {
    id: 'converter',
    title: 'Unit converter',
    category: 'Conversion',
    summary: 'Convert ETH to gwei and wei using a local, exact calculation. No network request is made.',
    input: 'An ETH amount, up to 18 decimals',
    output: 'ETH, gwei and wei, each copyable',
    badge: 'ETH → wei',
    keywords: ['eth', 'wei', 'gwei', 'bigint', 'units', 'gas'],
  },
  {
    id: 'lookup',
    title: 'Catalog lookup',
    category: 'Reference',
    summary: 'Quick links to tokens and collections in the local dataset.',
    input: 'A name or ticker (optional)',
    output: 'Links to detail pages',
    badge: 'Local dataset',
    keywords: ['token', 'collection', 'search', 'catalog', 'ticker', 'dataset'],
  },
]

export const TOOL_CATEGORIES: ToolCategory[] = ['Address utilities', 'Conversion', 'Reference']

export function matchTools(query: string, category: ToolCategory | 'all'): ToolMeta[] {
  const q = query.trim().toLowerCase()
  return TOOLS.filter(
    (t) => (category === 'all' || t.category === category) && (!q || `${t.title} ${t.category} ${t.summary} ${t.input} ${t.output} ${t.keywords.join(' ')}`.toLowerCase().includes(q)),
  )
}
