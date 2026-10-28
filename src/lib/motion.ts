import { useSyncExternalStore } from 'react'
import type { Transition, Variants } from 'motion/react'

/**
 * NEXORA motion system — one vocabulary for every page.
 *
 *   ease / dur ........ timing tokens (mirror the CSS --nx-ease / --nx-duration-*)
 *   stagger / rise .... container + child variants for section & grid entrances
 *   inView ............ spread onto a motion element to reveal it once on scroll
 *   hoverLift ......... card hover elevation
 *   popSpring ......... small springy feedback (badges, counts, toggles)
 *   useMotionReduced .. OS setting OR the in-app html[data-motion="reduced"] switch
 */

export const ease = [0.22, 1, 0.36, 1] as const
export const dur = { fast: 0.14, base: 0.22, slow: 0.42 } as const

export const tween = (duration: number = dur.base, delay = 0): Transition => ({ duration, delay, ease })
export const popSpring: Transition = { type: 'spring', stiffness: 520, damping: 28, mass: 0.7 }
export const layoutSpring: Transition = { type: 'spring', stiffness: 420, damping: 36, mass: 0.8 }

/** Parent: staggers children. */
export const stagger = (gap = 0.045, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
})

/** Child: soft rise + fade. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: dur.slow, ease } },
}

/** Child: fade only (dense rows, table lines). */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.base, ease } },
}

/** Spread on a motion element: reveals once when ~10% is visible. */
export const inView = {
  initial: 'hidden',
  whileInView: 'show',
  viewport: { once: true, amount: 0.1 },
} as const

export const hoverLift = {
  whileHover: { y: -3 },
  whileTap: { scale: 0.995 },
  transition: tween(dur.base),
} as const

/* ---- reduced-motion detection (OS or in-app setting), no provider needed ---- */

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
  return () => {
    mq.removeEventListener('change', onChange)
    mo.disconnect()
  }
}

export function motionReduced(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(QUERY).matches || document.documentElement.dataset.motion === 'reduced'
}

export function useMotionReduced(): boolean {
  return useSyncExternalStore(subscribe, motionReduced, () => false)
}
