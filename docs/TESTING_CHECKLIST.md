# NEXORA TRON Test Checklist

## Baseline regression
- [ ] `npm run build`
- [ ] `npm test`
- [ ] `npm run test:types`
- [ ] Existing Discover, Collections, Tokens, Watchlist, Wallet and Web3 routes still load.
- [ ] Existing EVM and Solana wallet connection/read-only features still behave as before.

## Connection and network
- [ ] Wallet extension missing: clear explanation, no crash.
- [ ] User rejects connection: error shown; retry possible.
- [ ] Connect to Nile: address and network shown accurately.
- [ ] Disconnect and reconnect work.
- [ ] Account switch updates displayed address and balance.
- [ ] Network switch away from Nile immediately disables send.
- [ ] Mainnet wallet cannot submit a transaction from the TRON testnet feature.
- [ ] Unknown/unverifiable network fails closed.

## Balance and send form
- [ ] Balance is fetched from the chain and loading/error/empty states are handled.
- [ ] Invalid recipient is rejected.
- [ ] Empty, zero, negative, excessive precision and malformed amounts are rejected.
- [ ] Amount conversion uses integer/base units, not floating-point arithmetic.
- [ ] User sees recipient, amount and network before wallet approval.
- [ ] User rejection does not display success.
- [ ] Network/account is rechecked immediately before signing/broadcast.

## End-to-end two-account test
- [ ] Account A and Account B are distinct TRON addresses.
- [ ] Both accounts are on Nile and independently funded with test TRX.
- [ ] Account A sends a small test amount to Account B.
- [ ] App distinguishes pending/submitted from confirmed/failed.
- [ ] Transaction appears on the Nile explorer.
- [ ] Account B balance/transaction reflects the transfer after confirmation.
- [ ] Sender's balance change and any fee/resource behavior are displayed sensibly.

## TRC-20 (only after native TRX passes)
- [ ] Contract address verified specifically for Nile.
- [ ] Token decimals and balance read from the token contract.
- [ ] Invalid contract/address and insufficient token balance are handled.
- [ ] User approves the transfer in wallet and result is confirmed on explorer.

## Security and hygiene
- [ ] No private keys or seed phrases in source, prompts, logs, or `.env.example`.
- [ ] `.env` is excluded from ZIPs and Git; only placeholder values are shared.
- [ ] No Mainnet transaction path is reachable from this milestone.
