import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SearchField({ value, onChange, placeholder, label, className }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; className?: string }) {
  return (
    <label className={cn('nx-field relative flex h-10 items-center', className)}>
      <Search className="pointer-events-none absolute left-3 size-4 text-mute" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className="h-full w-full bg-transparent pl-9 pr-8 text-[13px] text-ink outline-none placeholder:text-mute/70" />
      {value ? <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2 rounded p-1 text-mute hover:text-ink"><X className="size-3.5" /></button> : null}
    </label>
  )
}

/* ── Ecosystems: network atlas ─────────────────────────────────────────── */
