# NEXORA: Solana Devnet SOL balance stuck on "Loading"

Copy each file to the same path in your project root (the folder containing `src/`). Independent of the earlier wallet-connection ZIPs.

| File | Change |
|---|---|
| `src/hooks/use-solana-balance.ts` | Request now uses the bare Solana address (it was sending the internal key `Solana Devnet:<address>`). `loading` is derived instead of set from a deferred `setTimeout`. |
| `src/lib/solana-balance/solana-balance.ts` | One line: setup errors (`proxy-missing`, `not-configured`, `provider-auth`) now offer Retry. |
