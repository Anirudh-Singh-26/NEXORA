# NEXORA TRON Progress

Last updated: 2026-10-24

## Current checkpoint
- Received `Nexora(5).zip` as the current audit input.
- Static audit completed; no source code modified and no build/tests run by this audit.
- Current app uses React/Vite/TypeScript and Reown AppKit for EVM + Solana wallet connection.
- Existing wallet context does not sign/send transactions and does not include TRON support.
- Existing `/wallet`, `/web3`, `/tokens` and `/activity` routes/components should be considered for cohesive integration.
- Initial target: TRON Nile testnet, native TRX transfer first, optional TRC-20 afterward; keep Solana unchanged.

## Next exact actions
1. User places this `docs/` folder into the root of their backed-up base project.
2. User runs baseline build/test commands and reports failures (or asks for help fixing them before TRON work).
3. Prepare the first Claude research/technical-spike prompt, uploading only `package.json`, `src/lib/wallet/config.ts`, `src/features/wallet-provider.tsx`, relevant wallet page files, and these docs as needed. Do not upload `.env`.
4. Have Claude return only new/changed files and a file manifest. Review before replacing anything.

## Change log
- 2026-10-24: Initial project audit and TRON handover documents created. No app code changed.
