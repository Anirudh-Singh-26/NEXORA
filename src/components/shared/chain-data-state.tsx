import { AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { BlockchainErrorInfo, ChainResult, Provenance } from '@/lib/blockchain'

function clock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/** One-line description of where a value came from and how old it is. Makes no claim beyond what was measured. */
export function ProvenanceNote({ provenance, refreshError }: { provenance: Provenance; refreshError?: BlockchainErrorInfo | null }) {
  const age = Math.round(provenance.ageMs / 1000)
  const freshness = provenance.stale
    ? `stale: last known data, refresh failed (${refreshError?.message ?? 'provider unavailable'})`
    : provenance.fromCache ? `cached, ${age}s old` : 'fetched just now'
  const fallback = provenance.fallbackFrom.length > 0 ? ` · fell back from ${provenance.fallbackFrom.join(', ')}` : ''
  return (
    <p className={`text-[11px] leading-5 ${provenance.stale ? 'text-loss' : 'text-mute'}`}>
      {provenance.networkName} · source {provenance.source} · retrieved {clock(provenance.retrievedAt)} · {freshness}{fallback}
    </p>
  )
}

/** Inline unavailable/error message in the same style as the Web3 Data Lab alerts. */
export function UnavailableNotice({ error, onRetry }: { error: BlockchainErrorInfo; onRetry?: () => void }) {
  return (
    <div role="alert" className="mt-3 flex flex-wrap items-start gap-2 text-xs leading-5 text-loss">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">
        {error.message} This reflects the data provider, not necessarily the network itself.
      </span>
      {error.retryable && onRetry ? <button type="button" onClick={onRetry} className="rounded-lg border border-line px-2.5 py-1 text-ink">Retry</button> : null}
    </div>
  )
}

/**
 * Renders the non-success states of a chain read: loading, nothing requested, or unavailable.
 * Returns null when the result is ok so callers can render their own data (and a ProvenanceNote).
 */
export function ChainDataStatus<T>({ loading, result, onRetry }: { loading: boolean; result: ChainResult<T> | null; onRetry?: () => void }) {
  if (result?.status === 'ok') return null
  if (result?.status === 'unavailable' && !loading) return <UnavailableNotice error={result.error} onRetry={onRetry} />
  if (loading) {
    return (
      <div className="mt-3 space-y-2" role="status" aria-live="polite">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    )
  }
  return <EmptyState title="No data requested" body="Choose a network to read public blockchain data. No wallet is required." />
}
