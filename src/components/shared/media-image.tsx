import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type MediaImageProps = {
  src: string
  alt: string
  className?: string
  fallbackLabel?: string
  /** CSS object-position, e.g. "50% 30%" to keep a subject in frame when cropping. */
  position?: string
  fallbackSrc?: string
  /** Prioritize small, above-the-fold artwork such as the hero Live Drop thumbnail. */
  priority?: boolean
}

/**
 * Image with graceful loading: it fades in once decoded (the parent artwork
 * container supplies the shimmer), and falls back to a branded mesh tile.
 */
export function MediaImage({ src, alt, className, fallbackLabel, position, fallbackSrc, priority = false }: MediaImageProps) {
  const [activeSrc, setActiveSrc] = useState(src)
  const [fallbackTried, setFallbackTried] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setActiveSrc(src)
    setFallbackTried(false)
    setFailed(false)
    setLoaded(false)
  }, [src])
  const label = fallbackLabel ?? alt.slice(0, 2).toUpperCase()

  if (failed) {
    return (
      <div
        className={cn('mesh-fallback flex items-center justify-center text-xs font-medium tracking-[0.2em] text-mute', className)}
        role="img"
        aria-label={alt}
      >
        {label}
      </div>
    )
  }

  return (
    <img
      ref={(el) => {
        // Cached images can finish before React attaches onLoad.
        if (el?.complete && el.naturalWidth > 0) setLoaded(true)
      }}
      src={activeSrc}
      alt={alt}
      style={position ? { objectPosition: position } : undefined}
      className={cn('block h-full w-full object-cover', priority ? 'opacity-100' : 'transition-opacity duration-500', !priority && (loaded ? 'opacity-100' : 'opacity-0'), className)}
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (fallbackSrc && !fallbackTried && activeSrc !== fallbackSrc) {
          setFallbackTried(true)
          setLoaded(false)
          setActiveSrc(fallbackSrc)
          return
        }
        setFailed(true)
      }}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={priority ? 'sync' : 'async'}
      width={priority ? 40 : undefined}
      height={priority ? 40 : undefined}
    />
  )
}
