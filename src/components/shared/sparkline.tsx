import { motion } from 'motion/react'
import { useId } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { ease, useMotionReduced } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Compact trend line: soft gradient fill, 1.5px stroke, and a left-to-right
 * reveal on mount (a clip-path wipe — Recharts' own animation stalls when the
 * chart mounts inside a not-yet-laid-out, animating parent). Skipped under
 * reduced motion.
 */
export function Sparkline({
  data,
  positive,
  className,
}: {
  data: number[]
  positive: boolean
  className?: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const reduced = useMotionReduced()
  const series = data.map((value, index) => ({ index, value }))
  const color = positive ? '#70d8b1' : '#fb7185'

  return (
    <motion.div
      className={cn('h-9 w-28', className)}
      aria-hidden
      initial={reduced ? false : { clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0% 0 0)' }}
      transition={{ duration: 0.8, ease, delay: 0.1 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 3, right: 1, bottom: 1, left: 1 }}>
          <defs>
            <linearGradient id={`nx-spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#nx-spark-${uid})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
