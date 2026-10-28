# Claude Web Workflow for NEXORA

## Source of truth
The user's local backed-up NEXORA project is the base project. Claude receives only selected relevant files. The local repository and Git commits are the source of truth, not a Claude chat or generated archive.

## Required output format for every task
Claude must return:
1. A manifest of all files created or modified, with exact repository-relative paths.
2. The complete contents of each new/modified file, preserving the original path.
3. Any `package.json` / lockfile change explicitly called out.
4. Commands to run and tests performed (do not claim tests passed unless actually run).
5. Known limitations and the next bounded task.

Do not return a full-project ZIP. If Claude's interface offers file attachments, return only the changed/new files. If it cannot attach individual files, provide a small ZIP containing only those changed/new files and preserving directory paths.

## Task boundaries
- One feature/batch per session.
- Never rewrite the whole app or replace the wallet provider wholesale.
- Keep EVM and Solana behavior intact.
- No Mainnet transfer support in the TRON milestone.
- No secrets, `.env`, seed phrases or private keys in uploads.
- Do not make up token contract addresses or treat an unverified test token as official.
- Wait for the user to say when switching Claude accounts; prepare a concise handover prompt then.

## Before applying Claude output
- Inspect the file manifest and diff.
- Save the returned files locally.
- Apply changes to the backed-up base project only.
- Run build/tests and inspect browser behavior.
- Commit a known-good checkpoint before the next batch.
