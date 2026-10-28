import { motion, useMotionTemplate, useMotionValue, useSpring } from 'motion/react'
import type { ReactNode } from 'react'
import { useMotionReduced } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Restrained 3D hover: the surface leans a few degrees toward the pointer and a
 * soft light follows it. Use on a few hero-weight items only (lead card, drops),
 * never on every card. Mouse only; a plain wrapper for touch and reduced motion.
 */
export function TiltSurface({
  children,
  className,
  max = 4,
  glare = true,
}: {
  children: ReactNode
  className?: string
  /** Maximum tilt in degrees. Keep it small. */
  max?: number
  glare?: boolean
}) {
  const reduce = useMotionReduced()
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const gx = useMotionValue(50)
  const gy = useMotionValue(50)
  const lit = useMotionValue(0)
  const sx = useSpring(rx, { stiffness: 160, damping: 20, mass: 0.6 })
  const sy = useSpring(ry, { stiffness: 160, damping: 20, mass: 0.6 })
  const sl = useSpring(lit, { stiffness: 120, damping: 24 })
  const light = useMotionTemplate`radial-gradient(380px circle at ${gx}% ${gy}%, rgba(196,182,255,0.16), transparent 62%)`

  if (reduce) return <div className={cn('relative', className)}>{children}</div>

  return (
    <motion.div
      className={cn('relative will-change-transform', className)}
      style={{ rotateX: sx, rotateY: sy, transformPerspective: 1000 }}
      onPointerMove={(event) => {
        if (event.pointerType !== 'mouse') return
        const r = event.currentTarget.getBoundingClientRect()
        const px = (event.clientX - r.left) / r.width
        const py = (event.clientY - r.top) / r.height
        ry.set((px - 0.5) * 2 * max)
        rx.set(-(py - 0.5) * 2 * max)
        gx.set(px * 100)
        gy.set(py * 100)
        lit.set(1)
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
        lit.set(0)
      }}
    >
      {children}
      {glare ? <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-20 rounded-[inherit]" style={{ background: light, opacity: sl }} /> : null}
    </motion.div>
  )
}
