import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import type { ReactNode } from 'react'
import { MediaImage } from '@/components/shared/media-image'
import { cn } from '@/lib/utils'

/**
 * Reusable artwork container.
 *
 *  - shimmer placeholder while the image loads
 *  - restrained zoom + pointer parallax on `group` hover (fine pointers only,
 *    skipped under reduced motion)
 *  - one soft light sweep across the surface on hover (`sheen`)
 *  - inset hairline so artwork edges stay crisp against dark surfaces
 *
 * Put it inside any element with the `group` class. Children render above the
 * artwork (chips, buttons, captions).
 */
export function ArtworkFrame({
  src,
  alt,
  fallbackSrc,
  fallbackLabel,
  className,
  position,
  shade = 'bottom',
  parallax = true,
  sheen = true,
  children,
}: {
  src: string
  alt: string
  fallbackSrc?: string
  fallbackLabel?: string
  className?: string
  /** object-position for the crop, e.g. "50% 25%". */
  position?: string
  /** 'bottom' = soft scrim for captions; 'strong' = caption-heavy; 'none' = clean artwork */
  shade?: 'bottom' | 'strong' | 'none'
  parallax?: boolean
  sheen?: boolean
  children?: ReactNode
}) {
  const reduce = useReducedMotion()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const x = useSpring(px, { stiffness: 130, damping: 22, mass: 0.7 })
  const y = useSpring(py, { stiffness: 130, damping: 22, mass: 0.7 })
  const live = parallax && !reduce

  return (
    <div
      className={cn('nx-skeleton relative isolate overflow-hidden', className)}
      onPointerMove={
        live
          ? (event) => {
              if (event.pointerType !== 'mouse') return
              const r = event.currentTarget.getBoundingClientRect()
              px.set(((event.clientX - r.left) / r.width - 0.5) * -9)
              py.set(((event.clientY - r.top) / r.height - 0.5) * -9)
            }
          : undefined
      }
      onPointerLeave={live ? () => { px.set(0); py.set(0) } : undefined}
    >
      <motion.div
        className="absolute inset-0 scale-[1.04] transition-transform duration-[900ms] ease-[var(--ease-nx)] group-hover:scale-[1.08]"
        style={live ? { x, y } : undefined}
      >
        <MediaImage
          src={src}
          alt={alt}
          fallbackSrc={fallbackSrc}
          fallbackLabel={fallbackLabel}
          position={position}
          className="saturate-[.95] transition-[filter] duration-500 group-hover:saturate-[1.08]"
        />
      </motion.div>

      {shade !== 'none' ? (
        <div
          className={cn(
            'nx-artwork-shade pointer-events-none absolute inset-0',
            shade === 'strong' ? 'bg-gradient-to-t from-canvas via-canvas/40 to-transparent' : 'bg-gradient-to-t from-canvas/60 via-transparent to-transparent',
          )}
        />
      ) : null}

      {sheen && !reduce ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent [transition:none] group-hover:translate-x-[320%] group-hover:[transition:transform_1100ms_var(--ease-nx)]"
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" />
      {children}
    </div>
  )
}
