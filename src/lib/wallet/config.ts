import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react'
import { createAppKit } from '@reown/appkit/react'
import { parseProjectId } from './project-id.ts'
import { arbitrum, base, linea, mainnet, optimism, polygon, sepolia, solanaDevnet, type AppKitNetwork } from '@reown/appkit/networks'

/**
 * Wallet connection configuration (Reown AppKit + wagmi for EVM, Reown Solana adapter for Solana).
 *
 * VITE_REOWN_PROJECT_ID is a PUBLIC identifier (not a secret) from https://dashboard.reown.com. It is required for
 * WalletConnect and for the wallet list. Without it, the app still runs and the connect UI explains what is missing.
 */
export const REOWN_PROJECT_ID = parseProjectId(import.meta.env.VITE_REOWN_PROJECT_ID)
export const isWalletConfigured = REOWN_PROJECT_ID !== null

/** AppKit chain objects. Display metadata and chain IDs are canonical in network-config.ts; this list selects which AppKit networks are enabled. */
const evmNetworks = [mainnet, base, arbitrum, optimism, polygon, linea, sepolia] as const
/**
 * The Wallet page is testnet-only, so Solana Devnet is the ONLY Solana network offered to AppKit. AppKit starts the Solana
 * namespace on the first Solana network in this list; listing Solana mainnet ("Solana") before Devnet made every new Solana
 * session start on Mainnet-Beta (its CAIP address carries the mainnet genesis hash), which the Wallet page then correctly
 * reported as a mismatch. Do not add `solana` (mainnet) back here. EVM networks above are unchanged.
 */
const solanaNetworks = [solanaDevnet] as const
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [...evmNetworks, ...solanaNetworks]

const metadata = {
  name: 'NEXORA',
  description: 'NEXORA Observatory — read-only Web3 data',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
  icons: [],
}

function build() {
  if (!REOWN_PROJECT_ID) return null
  const wagmiAdapter = new WagmiAdapter({ projectId: REOWN_PROJECT_ID, networks: [...evmNetworks] })
  const solanaAdapter = new SolanaAdapter()
  createAppKit({
    adapters: [wagmiAdapter, solanaAdapter],
    projectId: REOWN_PROJECT_ID,
    networks,
    // Keep the initial AppKit network aligned with the Wallet page's Sepolia-only target. Other EVM networks remain
    // available to shared app features, but the Wallet page verifier rejects them for testnet portfolio reads.
    defaultNetwork: sepolia,
    metadata,
    themeMode: 'dark',
    themeVariables: {
      '--apkt-accent': '#a99aff',
      '--apkt-border-radius-master': '2px',
      '--apkt-font-family': 'inherit',
      '--apkt-z-index': 200,
    },
    // This milestone is connection + read-only data only: no email/social login, swaps, on-ramp, send or analytics.
    features: { analytics: false, email: false, socials: false, swaps: false, onramp: false, send: false, receive: false, history: false },
    enableWalletGuide: false,
  })
  return { wagmiAdapter }
}

/**
 * AppKit network objects used to make a namespace AppKit's active chain before its connect modal opens (see wallet-provider.tsx).
 * Same testnet targets as the rest of this file: Sepolia for EVM, Solana Devnet for Solana. Chain IDs stay canonical in network-config.ts.
 */
export const APPKIT_CONNECT_NETWORK = { evm: sepolia, solana: solanaDevnet } as const

export const walletRuntime = build()
export const wagmiConfig = walletRuntime?.wagmiAdapter.wagmiConfig ?? null
