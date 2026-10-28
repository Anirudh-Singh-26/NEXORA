import { RefreshCw, Search } from 'lucide-react'
import { SOURCE_LABEL, type SourceStatus } from '@/features/wallet/use-wallet-portfolio'

const TONE: Record<SourceStatus, string> = {
  live: 'is-live', loading: 'is-loading', stale: 'is-warn', unavailable: 'is-warn', empty: 'is-muted', unsupported: 'is-muted', idle: 'is-muted',
}

/** Honest status chip for one data source. Colour never carries meaning alone: the label always says it. */
export function SourcePill({ status, label }: { status: SourceStatus; label?: string }) {
  return <span className={`wlt-status ${TONE[status]}`}><i />{label ?? SOURCE_LABEL[status]}</span>
}

export type BadgeTone = 'connected' | 'busy' | 'warn' | 'idle' | 'info' | 'error'

export function StatusBadge({ tone = 'idle', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={`wlx-badge is-${tone}`}>{children}</span>
}

export function SectionHead({ label, title, aside }: { label?: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="wlt-section-head">
      <div>{label ? <p className="wlt-eyebrow">{label}</p> : null}<h2>{title}</h2></div>
      {aside}
    </div>
  )
}

export type StateTone = 'empty' | 'error' | 'info'

/** One consistent block for empty / error / informational states. Empty is calm; error is clearly different. */
export function StateBlock({ icon, title, children, tone = 'empty', action, role }: { icon: React.ReactNode; title: string; children?: React.ReactNode; tone?: StateTone; action?: React.ReactNode; role?: 'alert' | 'status' }) {
  return (
    <div className={`wlt-state is-${tone}`} role={role ?? (tone === 'error' ? 'alert' : undefined)}>
      <span className="wlt-state__icon" aria-hidden="true">{icon}</span>
      <div className="wlt-state__body">
        <strong>{title}</strong>
        {children ? <p>{children}</p> : null}
        {action}
      </div>
    </div>
  )
}

export function RefreshButton({ onClick, busy, label }: { onClick: () => void; busy: boolean; label: string }) {
  return (
    <button type="button" className="wlt-btn wlt-btn--sm" onClick={onClick} disabled={busy} aria-label={label}>
      <RefreshCw size={14} className={busy ? 'wlt-spin' : ''} aria-hidden="true" />Refresh
    </button>
  )
}

export function SearchField({ value, onChange, label, placeholder }: { value: string; onChange: (next: string) => void; label: string; placeholder: string }) {
  return (
    <label className="wlt-search">
      <Search size={15} aria-hidden="true" />
      <span className="wlt-sr">{label}</span>
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} />
    </label>
  )
}

export function RowSkeletons({ count = 3, label }: { count?: number; label: string }) {
  return (
    <div className="wlt-skel-rows" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, index) => <div key={index} className="wlt-skel wlt-skel--row" />)}
    </div>
  )
}
