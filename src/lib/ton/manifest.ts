/**
 * TON Connect manifest checks (pure). The manifest is a public JSON file ({ url, name, iconUrl, ... }) that the
 * wallet downloads to show the user which app is asking to connect. See docs.ton.org (TON Connect manifest).
 *
 * The shipped file uses a reserved ".invalid" host as a placeholder (RFC 2606), which can never resolve, so an
 * unconfigured deployment is detected reliably instead of failing opaquely inside a wallet.
 */

export const TON_MANIFEST_PATH = '/tonconnect-manifest.json'

export type TonManifestCheck =
  | { status: 'ok'; originMismatch: boolean }
  | { status: 'placeholder' }
  | { status: 'invalid'; problems: string[] }

function parseHttpUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

function isPlaceholderHost(url: URL): boolean {
  return url.hostname === 'invalid' || url.hostname.endsWith('.invalid')
}

export function checkTonManifest(json: unknown, pageOrigin: string): TonManifestCheck {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return { status: 'invalid', problems: ['The manifest is not a JSON object.'] }
  const record = json as Record<string, unknown>
  const url = parseHttpUrl(record.url)
  const icon = parseHttpUrl(record.iconUrl)
  if ((url && isPlaceholderHost(url)) || (icon && isPlaceholderHost(icon))) return { status: 'placeholder' }

  const problems: string[] = []
  if (!url) problems.push('"url" must be an absolute http(s) URL.')
  if (typeof record.name !== 'string' || record.name.trim() === '') problems.push('"name" must be a non-empty string.')
  if (!icon) problems.push('"iconUrl" must be an absolute http(s) URL.')
  else if (/\.svg(?:$|[?#])/i.test(icon.pathname + icon.search)) problems.push('"iconUrl" should be a PNG or ICO; wallets may not render SVG.')
  if (problems.length > 0) return { status: 'invalid', problems }
  return { status: 'ok', originMismatch: (url as URL).origin !== pageOrigin }
}

export type TonManifestUrlResult = { ok: true; url: string } | { ok: false; message: string }

/**
 * The manifest URL handed to TON Connect: VITE_TONCONNECT_MANIFEST_URL when set (must be https, or http on
 * localhost), otherwise `<origin>/tonconnect-manifest.json` served from the Vite public/ folder.
 */
export function resolveTonManifestUrl(raw: string | undefined | null, pageOrigin: string): TonManifestUrlResult {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (value === '') return { ok: true, url: `${pageOrigin}${TON_MANIFEST_PATH}` }
  const url = parseHttpUrl(value)
  if (!url) return { ok: false, message: 'VITE_TONCONNECT_MANIFEST_URL must be an absolute URL.' }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !local) return { ok: false, message: 'VITE_TONCONNECT_MANIFEST_URL must use https (http is allowed only for localhost).' }
  if (url.username || url.password) return { ok: false, message: 'VITE_TONCONNECT_MANIFEST_URL must not contain credentials.' }
  return { ok: true, url: url.toString() }
}
