/**
 * Maps a TON Connect error to a short, user-facing message. Class names can be mangled by minifiers, so this
 * matches on the message text only and falls back to a generic sentence rather than echoing raw internals.
 */
export function describeTonConnectError(error: unknown): string {
  const text = error instanceof Error ? `${error.name} ${error.message}` : typeof error === 'string' ? error : ''
  if (/reject|declin|denied|cancel/i.test(text)) return 'The connection request was declined in the wallet. Nothing was connected.'
  if (/manifest/i.test(text)) return 'The wallet could not load NEXORA’s TON Connect manifest. Check that the manifest URL is public HTTPS and its fields are correct (see the setup notes).'
  if (/already connected/i.test(text)) return 'A TON wallet is already connected. Disconnect it first.'
  if (/fetch|network|timeout/i.test(text)) return 'The TON wallet service could not be reached. Check your connection and try again.'
  return 'The TON wallet reported an error. Try again, or disconnect and reconnect.'
}
