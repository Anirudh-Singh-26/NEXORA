import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Database, RotateCcw, PanelLeftClose, Rows3, Trash2, Waves } from 'lucide-react'
import { dur, ease } from '@/lib/motion'
import { useUiStore } from '@/store/ui-store'
import { useWatchlistStore } from '@/store/watchlist-store'
import { SettingRow, Switch } from '@/features/workspaces/settings/settings-controls'
import { readStored, writeStored } from '@/features/workspaces/shared/browser-storage'

const MOTION_KEY = 'nexora-reduced-motion'


const COMPACT_KEY = 'nexora-compact'


export function SettingsWorkspace() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)
  const [reduced, setReduced] = useState(() => {
    const stored = readStored(MOTION_KEY)
    return stored === 'true' || (stored === null && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  })
  const [compact, setCompact] = useState(() => readStored(COMPACT_KEY) === 'true')
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const counts = useWatchlistStore((s) => s.tokenIds.length + s.collectionIds.length + s.assetIds.length + s.campaignIds.length)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    if (!confirmClear) return
    const timer = window.setTimeout(() => setConfirmClear(false), 5000)
    return () => window.clearTimeout(timer)
  }, [confirmClear])

  const setMotion = (next: boolean) => {
    setReduced(next)
    document.documentElement.dataset.motion = next ? 'reduced' : 'full'
    setNotice(writeStored(MOTION_KEY, String(next)) ? `Reduce motion ${next ? 'on' : 'off'} · saved in this browser` : `Reduce motion ${next ? 'on' : 'off'} · applied for this session only`)
  }
  const setCompactTables = (next: boolean) => {
    setCompact(next)
    document.documentElement.dataset.compact = String(next)
    setNotice(writeStored(COMPACT_KEY, String(next)) ? `Compact tables ${next ? 'on' : 'off'} · saved in this browser` : `Compact tables ${next ? 'on' : 'off'} · applied for this session only`)
  }
  const resetPreferences = () => {
    try { localStorage.removeItem(MOTION_KEY); localStorage.removeItem(COMPACT_KEY) } catch { /* storage unavailable */ }
    delete document.documentElement.dataset.motion
    delete document.documentElement.dataset.compact
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    setCompact(false)
    setNotice('Preferences reset to defaults')
  }
  const clearWatchlist = () => {
    useWatchlistStore.setState({ tokenIds: [], collectionIds: [], assetIds: [], campaignIds: [] })
    setConfirmClear(false)
    setNotice('Watchlist cleared')
  }

  const sections = [
    { id: 'appearance', label: 'Motion & display' },
    { id: 'layout', label: 'Layout' },
    { id: 'data', label: 'Local data' },
  ]

  return (
    <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,720px)]">
      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-[calc(var(--nx-topbar)+24px)] space-y-1 border-l border-line/70">
          {sections.map((s) => (
            <li key={s.id}><a href={`#settings-${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`settings-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} className="-ml-px block border-l border-transparent px-4 py-1.5 text-[12.5px] text-mute transition-colors hover:border-copper/60 hover:text-ink">{s.label}</a></li>
          ))}
        </ul>
      </nav>

      <div className="space-y-8">
        <div aria-live="polite" role="status" className="sticky top-[calc(var(--nx-topbar)+8px)] z-20 h-0">
          {notice ? (
            <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.base, ease }} className="inline-flex items-center gap-2 rounded-full border border-copper/40 bg-raised/95 px-3.5 py-1.5 text-[12px] shadow-xl backdrop-blur"><Check size={13} className="text-copper" />{notice}</motion.p>
          ) : null}
        </div>

        <section id="settings-appearance" className="scroll-mt-24" aria-labelledby="set-h-appearance">
          <h2 id="set-h-appearance" className="nx-eyebrow mb-3 text-[10px]">Motion &amp; display</h2>
          <div className="nx-surface overflow-hidden rounded-xl">
            <SettingRow icon={<Waves size={16} />} title="Reduce motion" hint="Use the operating system motion preference where supported." control={<Switch checked={reduced} onChange={setMotion} label="Reduce motion" />} last />
          </div>
        </section>

        <section id="settings-layout" className="scroll-mt-24" aria-labelledby="set-h-layout">
          <h2 id="set-h-layout" className="nx-eyebrow mb-3 text-[10px]">Layout</h2>
          <div className="nx-surface overflow-hidden rounded-xl">
            <SettingRow icon={<Rows3 size={16} />} title="Compact data tables" hint="Preference for a denser information layout." control={<Switch checked={compact} onChange={setCompactTables} label="Compact data tables" />} />
            <SettingRow icon={<PanelLeftClose size={16} />} title="Collapse sidebar" hint="Start with the navigation rail minimised. Also available from the sidebar itself." control={<Switch checked={sidebarCollapsed} onChange={(next) => { setSidebarCollapsed(next); setNotice(`Sidebar ${next ? 'collapsed' : 'expanded'} · saved in this browser`) }} label="Collapse sidebar" />} last />
          </div>
        </section>

        <section id="settings-data" className="scroll-mt-24" aria-labelledby="set-h-data">
          <h2 id="set-h-data" className="nx-eyebrow mb-3 text-[10px]">Local data</h2>
          <div className="nx-surface overflow-hidden rounded-xl">
            <div className="flex items-start gap-4 px-5 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line/80 bg-inset/60 text-copper"><Database size={16} /></span>
              <div className="min-w-0 flex-1"><p className="text-[13.5px] font-medium">Stored in this browser</p><p className="mt-0.5 text-[12px] leading-5 text-mute">Watchlist, profile name, and these preferences are stored in this browser. Clearing site storage removes them.</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 border-t border-line/70 bg-canvas/30 px-5 py-3.5">
              <button type="button" onClick={resetPreferences} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-xs text-ink transition-colors hover:bg-inset"><RotateCcw size={13} /> Reset preferences</button>
              {confirmClear ? (
                <>
                  <button type="button" onClick={clearWatchlist} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-loss/50 bg-loss/10 px-3 text-xs text-loss transition-colors hover:bg-loss/20">Confirm: remove {counts} saved {counts === 1 ? 'item' : 'items'}</button>
                  <button type="button" onClick={() => setConfirmClear(false)} className="text-xs text-mute hover:text-ink">Cancel</button>
                </>
              ) : (
                <button type="button" disabled={counts === 0} onClick={() => setConfirmClear(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-xs text-mute transition-colors hover:border-loss/40 hover:text-loss disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={13} /> Clear watchlist{counts ? ` (${counts})` : ''}</button>
              )}
            </div>
          </div>
          <p className="mt-3 text-[11.5px] leading-5 text-mute">Nothing here is sent to a server. There is no account, wallet connection or sync.</p>
        </section>
      </div>
    </div>
  )
}
