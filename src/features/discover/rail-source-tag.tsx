/** One-line provenance for a Discover rail: where the figures come from, or an explicit "Illustrative data" label. */
export function RailSourceTag({ state, label, source, sourceUrl, updatedAt, note }: {
  state: 'live' | 'loading' | 'unavailable'
  label: string
  source: string
  sourceUrl: string
  updatedAt?: number | null
  note?: string | null
}) {
  const time = updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
  return (
    <p role="status" className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[11px] text-mute">
      {state === 'live' ? <>
        <span className="font-medium text-ink">Live {label}</span>
        <span>· <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-copper hover:underline">{source}</a>{time ? ` · updated ${time}` : ''}</span>
      </> : <>
        <span className="font-medium text-ink">Illustrative data</span>
        <span>· {state === 'loading' ? `loading live ${label}…` : `live ${label} unavailable${note ? ` (${note})` : ''}; showing demo figures, not real market data.`}</span>
      </>}
    </p>
  )
}
