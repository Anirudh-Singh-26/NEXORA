import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Check, Copy } from 'lucide-react'
import { dur, ease } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function CopyButton({ value, label, disabled }: { value: string; label: string; disabled?: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const timer = window.setTimeout(() => setState('idle'), 1600)
    return () => window.clearTimeout(timer)
  }, [state])
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setState('copied') } catch { setState('failed') }
      }}
      className={cn('inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40', state === 'copied' ? 'border-gain/40 text-gain' : state === 'failed' ? 'border-loss/40 text-loss' : 'border-line text-mute hover:border-copper/40 hover:text-ink')}
    >
      {state === 'copied' ? <Check size={12} /> : <Copy size={12} />}
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}</span>
    </button>
  )
}


export function ToolCard({ icon, title, blurb, badge, children, className }: { icon: ReactNode; title: string; blurb: string; badge?: string; children: ReactNode; className?: string }) {
  return (
    <motion.section whileHover={{ y: -2 }} transition={{ duration: dur.base, ease }} className={cn('nx-panel nx-interactive group relative overflow-clip rounded-2xl p-5 md:p-6', className)}>
      <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-copper/60 to-transparent opacity-60 transition-opacity group-hover:opacity-100" />
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-copper/[0.07] blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex items-start gap-3.5">
        <span className="nx-brand-mark flex size-10 shrink-0 items-center justify-center rounded-xl border border-copper/25 text-copper">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
            {badge ? <span className="nx-eyebrow rounded-full border border-line/80 px-2 py-0.5 text-[8.5px]">{badge}</span> : null}
          </div>
          <p className="mt-1 text-[12.5px] leading-5 text-mute">{blurb}</p>
        </div>
      </div>
      <div className="relative mt-5">{children}</div>
    </motion.section>
  )
}
