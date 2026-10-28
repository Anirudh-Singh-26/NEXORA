/**
 * Best-effort display name for the connected wallet. TON Connect exposes the wallet's catalogue name
 * (`name`) when the wallet was picked from the list, and the self-reported app name (`device.appName`) otherwise.
 * Both are untrusted display strings, so they are trimmed and length-limited.
 */
export function pickTonWalletName(wallet: unknown): string | null {
  if (typeof wallet !== 'object' || wallet === null) return null
  const record = wallet as { name?: unknown; device?: unknown }
  const direct = typeof record.name === 'string' ? record.name.trim() : ''
  if (direct) return direct.slice(0, 40)
  const device = typeof record.device === 'object' && record.device !== null ? (record.device as { appName?: unknown }) : null
  const appName = device && typeof device.appName === 'string' ? device.appName.trim() : ''
  return appName ? appName.slice(0, 40) : null
}
