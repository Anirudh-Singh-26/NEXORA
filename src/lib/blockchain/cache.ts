/** Small bounded LRU cache with a hard expiry per entry. Freshness decisions live in the client, not here. */
interface Entry<V> { value: V; storedAt: number; expiresAt: number }

export class BoundedCache<V> {
  private entries = new Map<string, Entry<V>>()
  private maxEntries: number

  constructor(maxEntries: number) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries))
  }

  get size(): number { return this.entries.size }

  get(key: string, now: number): { value: V; storedAt: number } | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (now >= entry.expiresAt) {
      this.entries.delete(key)
      return undefined
    }
    // Refresh recency (Map preserves insertion order).
    this.entries.delete(key)
    this.entries.set(key, entry)
    return { value: entry.value, storedAt: entry.storedAt }
  }

  set(key: string, value: V, now: number, maxAgeMs: number): void {
    this.entries.delete(key)
    this.entries.set(key, { value, storedAt: now, expiresAt: now + maxAgeMs })
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next()
      if (oldest.done) break
      this.entries.delete(oldest.value)
    }
  }

  clear(): void { this.entries.clear() }
}
