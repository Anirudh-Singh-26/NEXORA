import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { popSpring } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn('relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200', checked ? 'border-copper/60 bg-copper/30' : 'border-line bg-inset')}>
      <motion.span className={cn('absolute left-0.5 top-0.5 size-4.5 rounded-full shadow', checked ? 'bg-copper' : 'bg-mute')} animate={{ x: checked ? 20 : 0 }} transition={popSpring} style={{ width: 18, height: 18 }} />
    </button>
  )
}


export function SettingRow({ icon, title, hint, control, last }: { icon: ReactNode; title: string; hint: string; control: ReactNode; last?: boolean }) {
  return (
    <div className={cn('flex items-center gap-4 px-5 py-4', !last && 'border-b border-line/70')}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line/80 bg-inset/60 text-copper">{icon}</span>
      <div className="min-w-0 flex-1"><p className="text-[13.5px] font-medium">{title}</p><p className="mt-0.5 text-[12px] leading-5 text-mute">{hint}</p></div>
      {control}
    </div>
  )
}
