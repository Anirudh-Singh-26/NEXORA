# NEXORA Architecture Audit — TRON Work

Audit source: `Nexora(5).zip` uploaded on 2026-10-24. This is a static source review; no build or tests have been run in the user's local environment.

## Current application shape

- React 19 + Vite + TypeScript.
- React Router application with existing routes including `/discover`, `/collections`, `/tokens`, `/watchlist`, `/wallet`, `/web3`, `/activity`, `/swap`, `/tools`, `/profile`, and `/settings`.
- Shared app shell, wallet connect button, wallet setup dialog, existing wallet page and wallet-related styles are already present.
- Reown AppKit is used for EVM wallet connections via Wagmi and Solana via Reown's Solana adapter.
- `src/features/wallet-provider.tsx` exposes an application-wide wallet context for EVM and Solana; it explicitly does not sign or send transactions.
- `src/lib/wallet/config.ts` configures EVM networks and Solana. It does not configure TRON.
- Existing wallet data modules include token balances, NFT data and wallet activity, with several Solana-specific modules and API routes.
- `package.json` has no explicit TRON wallet adapter or TronWeb dependency at audit time.

## Implications

1. Do not replace the wallet provider wholesale. Existing EVM and Solana functionality must remain intact.
2. TRON is a separate wallet ecosystem and address format; do not force TRON addresses through EVM (`0x...`) or Solana address handling.
3. Integrate TRON as a separate, typed wallet capability and reuse NEXORA's existing visual system and wallet/assets/activity surfaces where appropriate.
4. Preserve all existing routes and features. Avoid creating a separate, visually unrelated demo app.
5. TRON transactions must be disabled unless the connected wallet is positively verified to be on the selected testnet. Do not rely on a UI badge alone.
6. No custom smart contract is required for a native TRX transfer. TRC-20 transfers can be considered after native testnet transfers work, using a verified token contract deployed on the chosen testnet.

## Build / test status

Not run during this static audit. Before implementation, run the project's existing commands locally:

- `npm install` (only if dependencies are not installed)
- `npm run build`
- `npm test`
- `npm run test:types`

Record pre-existing failures before applying any changes so they are not mistaken for TRON regressions.

## Credential hygiene warning

The uploaded ZIP contains a `.env` file with variables named `OPENSEA_API_KEY`, `ALCHEMY_API_KEY`, `SOLANA_RPC_URL`, and `VITE_REOWN_PROJECT_ID`. Values were not included in this audit document. Do not include `.env` in future ZIP uploads or share it with Claude. Check whether `.env` is tracked by Git; keep it local and use `.env.example` with placeholders. If any private/paid API credential was exposed beyond its intended audience, rotate it. A `VITE_` variable is public to browser code and must never contain a secret.
