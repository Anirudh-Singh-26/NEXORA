import { motion, useScroll, useTransform } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { MediaImage } from '@/components/shared/media-image'
import { useMotionReduced } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Wide artwork banner whose image drifts slowly against page scroll.
 * Static under reduced motion. Children render above the image.
 */
export function ParallaxBanner({
  src,
  alt = '',
  className,
  strength = 34,
  position,
  fallbackLabel,
  children,
}: {
  src: string
  alt?: string
  className?: string
  /** Max vertical drift in px (image is oversized to absorb it). */
  strength?: number
  position?: string
  fallbackLabel?: string
  children?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useMotionReduced()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength])

  return (
    <div ref={ref} className={cn('nx-skeleton relative isolate overflow-hidden', className)}>
      <motion.div className="absolute inset-x-0 -inset-y-[14%]" style={reduced ? undefined : { y }}>
        <MediaImage src={src} alt={alt} position={position} fallbackLabel={fallbackLabel} />
      </motion.div>
      {children}
    </div>
  )
}
