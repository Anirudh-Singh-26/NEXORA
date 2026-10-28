/**
 * Validates a Reown project ID from VITE_REOWN_PROJECT_ID. Pure (no env, no React) so it can be unit-tested.
 * Accepts plain alphanumeric IDs (e.g. 32 hex chars) and UUID-style hyphenated IDs. Returns null for missing or
 * malformed input so wallet connections are treated as "not configured" rather than starting with a bad ID.
 */
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{6,126})[a-zA-Z0-9]$/

export function parseProjectId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return PROJECT_ID_PATTERN.test(trimmed) ? trimmed : null
}
