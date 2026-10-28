# TRON Research Notes for NEXORA

Status: initial research baseline; verify the official docs again when implementation starts.

## Terms

- TRON: blockchain network.
- TRX: native asset used for transfers and network resources.
- TRC-20: token standard for tokens implemented by a smart contract on TRON.
- Wallet: user-controlled account interface that approves/signs transactions.
- Testnet: separate blockchain environment whose test assets have no real monetary value.
- Telegram: messaging platform. TRON developer community bots may distribute test tokens; Telegram accounts are not themselves blockchain wallets.

## Suggested first network

Use **Nile testnet** as the initial implementation target, unless a manager or current official docs specify otherwise. Keep the network selection centralized so Shasta could be substituted later without rewriting UI components. Do not support Mainnet transactions in this milestone.

Official references:
- TRON getting started: https://developers.tron.network/docs/getting-started
- TRON network connection / TronWeb: https://developers.tron.network/docs/connect-to-the-tron-network
- Official testnet token guide (Nile and Shasta faucets, Telegram bot instructions, testnet explorer links): https://developers.tron.network/docs/getting-testnet-tokens-on-tron
- TRON Wallet Adapter docs: https://www.walletadapter.org/docs/
- TronLink network reference: https://docs.tronlink.org/reference/networks/

## Wallet / SDK approach to evaluate

Evaluate `@tronweb3/tronwallet-adapters` (including `TronLinkAdapter`) and `tronweb` as a focused TRON integration. The wallet adapter connects to the user's browser wallet; TronWeb builds/reads TRON transactions and network data. Confirm package versions and compatibility before changing dependencies. Do not put private keys or seed phrases in application code, `.env` values prefixed with `VITE_`, prompts, or source files.

## Transfer scope

1. First milestone: native TRX transfer on Nile from Account A to Account B, signed by the connected wallet.
2. Read and display the connected account's Nile TRX balance.
3. Show transaction lifecycle (awaiting wallet approval, submitted, confirmed, failed/rejected) and a Nile explorer link.
4. After this works: optional TRC-20 transfer using a token contract verified specifically for Nile. Never reuse a Mainnet token contract address on testnet without verification.

## Safety requirements

- Check network using the wallet/provider and/or a trusted network verification method before balance or transaction actions.
- If network is Mainnet, unknown, or cannot be verified, disable send actions and show a clear explanation. Do not silently broadcast.
- Re-check network and sender address immediately before building/signing/broadcasting a transaction, to handle wallet/network changes.
- User must review and approve transactions in the wallet. Never request a seed phrase/private key.
- Validate recipient address and amount; reject zero/negative, malformed, excessive precision and unsafe numeric conversions.
- Use integer/base-unit conversions (TRX uses SUN; 1 TRX = 1,000,000 SUN). Avoid floating-point math for transaction values.
- Do not report success just because a transaction was submitted; wait for chain confirmation / receipt status.
- Keep all testnet-specific endpoints and explorer URLs centralized and clearly named.

## Telegram note

Official TRON documentation describes obtaining test tokens via faucet websites and a community bot in Telegram/Discord. A second Telegram account is not a blockchain requirement. The actual sender and receiver must be two independent TRON wallet addresses. Never send private keys or seed phrases to a bot or person.
