import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { inView, rise } from '@/lib/motion'

/** Scroll reveal: soft rise + fade the first time ~10% of the block is visible. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      {...inView}
      variants={{ hidden: rise.hidden, show: { ...(rise.show as object), transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay } } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
