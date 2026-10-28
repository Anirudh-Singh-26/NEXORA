import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Award, Check, ShieldAlert } from 'lucide-react'
import { rewardQuestSeeds, rewardSummarySeeds } from '@/data/catalog'
import { ease } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useWatchlistStore } from '@/store/watchlist-store'

export function RewardsWorkspace() {
  const savedTokens = useWatchlistStore((s) => s.tokenIds.length)
  const points = 2450
  const tierFloor = 2000
  const tierCeil = 3000
  const pct = ((points - tierFloor) / (tierCeil - tierFloor)) * 100
  const quests = rewardQuestSeeds.map((quest) => {
    if (quest.completionRule === 'always-demo') return { ...quest, done: true, progress: 1 }
    if (quest.completionRule === 'saved-tokens') return { ...quest, done: savedTokens >= quest.goal, progress: Math.min(savedTokens, quest.goal) }
    return { ...quest, done: false, progress: 0 }
  })
  const stats = rewardSummarySeeds.map(({ label, value }) => [label, value])

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <section className="nx-panel relative overflow-hidden rounded-2xl p-5 md:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-copper/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="nx-eyebrow text-[9.5px]">Demo tier</p>
              <p className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-tight">Explorer II</p>
            </div>
            <p className="font-mono text-[12px] tabular-nums text-mute"><span className="text-ink">{(tierCeil - points).toLocaleString('en-US')}</span> pts to Explorer III</p>
          </div>
          <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-line/60" role="progressbar" aria-valuemin={tierFloor} aria-valuemax={tierCeil} aria-valuenow={points} aria-label="Progress to next demo tier">
            <motion.span className="block h-full rounded-full bg-gradient-to-r from-copper to-sage" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease }} />
          </div>
          <div className="relative mt-1.5 flex justify-between font-mono text-[10.5px] tabular-nums text-mute/70"><span>{tierFloor.toLocaleString('en-US')}</span><span>{tierCeil.toLocaleString('en-US')}</span></div>
          <dl className="relative mt-5 grid grid-cols-3 divide-x divide-line/70 rounded-xl border border-line/70 bg-canvas/40">
            {stats.map(([label, value]) => (
              <div key={label} className="px-4 py-3"><dd className="font-mono text-[19px] leading-none tabular-nums">{value}</dd><dt className="nx-eyebrow mt-1.5 text-[9px]">{label}</dt></div>
            ))}
          </dl>
          <p className="nx-eyebrow relative mt-4 text-[9px] text-copper">Illustrative only · no monetary value</p>
        </section>

        <section className="nx-surface rounded-xl">
          <div className="flex items-center justify-between border-b border-line/70 px-5 py-3.5">
            <h2 className="text-[15px] font-semibold tracking-tight">Example activities</h2>
            <span className="font-mono text-[11px] text-mute">{quests.filter((q) => q.done).length}/{quests.length} done</span>
          </div>
          <ul>
            {quests.map((q) => (
              <li key={q.name} className="border-b border-line/70 last:border-0">
                <Link to={q.to} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-inset/40">
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full border', q.done ? 'border-copper/50 bg-copper/15 text-copper' : 'border-line bg-inset text-mute')}>
                    {q.done ? <Check size={16} /> : <Award size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px]">{q.name}</span>
                    <span className="mt-2 flex items-center gap-2">
                      <span className="h-1 w-24 overflow-hidden rounded-full bg-line/60"><span className="block h-full rounded-full bg-copper/70" style={{ width: `${(q.progress / q.goal) * 100}%` }} /></span>
                      <span className="font-mono text-[10.5px] tabular-nums text-mute">{q.progress}/{q.goal}</span>
                    </span>
                  </span>
                  <span className={cn('font-mono text-[13px] tabular-nums', q.done ? 'text-mute' : 'text-copper')}>+{q.points} pts</span>
                  <ArrowRight size={14} className="text-mute/50 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="space-y-4">
        <div className="nx-surface rounded-xl p-4">
          <p className="nx-eyebrow text-[9.5px]">Tier ladder</p>
          <ol className="mt-3 space-y-3">
            {[['Explorer I', '0 – 1,999', true], ['Explorer II', '2,000 – 2,999', true], ['Explorer III', '3,000+', false]].map(([n, r, reached]) => (
              <li key={String(n)} className="flex items-center gap-3 text-[12.5px]">
                <span className={cn('size-2 rounded-full', reached ? 'bg-copper' : 'bg-line')} />
                <span className={reached ? 'text-ink' : 'text-mute'}>{n}</span>
                <span className="ml-auto font-mono text-[11px] tabular-nums text-mute">{r}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="flex items-start gap-2 rounded-lg border border-dashed border-line/80 px-3.5 py-2.5 text-[11.5px] leading-5 text-mute">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-copper" />
          Points, tiers and activities are fictional. “Save three tokens” reads your local watchlist; nothing else is tracked.
        </p>
      </aside>
    </div>
  )
}

/* ── Notifications: inbox ──────────────────────────────────────────────── */
