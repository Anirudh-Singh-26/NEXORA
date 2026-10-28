# NEXORA TRON Implementation Plan

## Product objective

Add a real TRON testnet workflow to the existing NEXORA app while preserving its established design, routes, EVM support and Solana support. First deliver a testnet-only native TRX transfer between two independently controlled accounts. Do not begin Solana changes in this phase.

## Phase 0 — Baseline and architecture (current)

- [x] Review uploaded source tree, package dependencies, routes and wallet provider.
- [x] Identify existing `/wallet`, `/web3`, `/tokens` and `/activity` surfaces that may be extended.
- [ ] User runs baseline build and test commands locally and records existing failures.
- [ ] Confirm latest base project is safely backed up and `.env` is excluded from future uploads.

## Phase 1 — Technical spike (no broad UI redesign)

- Confirm current official TRON testnet and wallet adapter docs.
- Select Nile as initial testnet unless requirements change.
- Verify TronLink connection API and event handling with current adapter versions.
- Decide how TRON state fits beside, rather than inside, the existing EVM/Solana wallet context.
- Produce a small file-level change plan before implementation.

## Phase 2 — TRON wallet connection

- Add a separate typed TRON connection module/provider/hook without breaking `useWallet()` consumers.
- Connect/disconnect; expose wallet name, TRON address, active network and connection errors.
- Handle account changes, disconnects, unavailable wallet and network changes.
- Add clear Nile-only state; Mainnet/unknown network is read-only and cannot send.

## Phase 3 — Balance and native TRX transfer

- Read Nile native TRX balance for the connected address.
- Build send form within NEXORA's existing wallet/assets UI pattern.
- Validate destination, amount and fee/resource information where supported.
- Ask the wallet to sign/approve; broadcast only through the expected testnet path.
- Wait for transaction confirmation and display transaction ID + Nile explorer link.
- Add tests for validation, network mismatch, account change, user rejection and failed/pending transaction states.

## Phase 4 — Optional TRC-20 transfer

- Select a token only after verifying its contract address on Nile from a trusted source.
- Read token balance and decimals from the contract.
- Transfer with wallet approval and show confirmation status.
- If no suitable existing token is available, decide whether deploying a test-only sample token is in scope; do not assume a custom contract is required for native TRX.

## Phase 5 — UX integration and acceptance

- Reuse existing design tokens, wallet page, asset rows, activity components and loading/error patterns.
- Avoid a standalone disconnected demo page unless the existing architecture requires a focused route.
- Verify two independent accounts in two browser profiles/systems.
- Confirm the receiver's balance change and explorer transaction record.
- Explicitly verify that a Mainnet-connected wallet cannot send from this testnet feature.
- Run build, unit/type tests and manual regression checks for existing EVM/Solana features.

## Acceptance criteria

- Existing app builds and existing EVM/Solana wallet behavior is not regressed.
- A user can connect a TRON wallet and see the address/network.
- Nile balance is fetched from chain, not mocked.
- A native TRX testnet transfer is signed by the wallet and confirmed on Nile.
- Account B can independently see the incoming transfer/balance change.
- Transaction state is accurate and includes an explorer link.
- Mainnet or unverified network disables sending.
- No private key/seed phrase is stored or requested by NEXORA.
- Claude returns only changed/new files with exact repository paths, plus a concise dependency/test note; never a whole-project ZIP.
