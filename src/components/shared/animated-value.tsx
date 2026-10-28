import { useEffect, useRef, useState } from 'react'
import { formatCompact, formatPercent, formatUsdCompact } from '@/lib/format'

export type AnimatedValueFormat = 'integer' | 'padded' | 'compact' | 'usdCompact' | 'percent' | 'decimal1'

function formatValue(value: number, format: AnimatedValueFormat) {
  switch (format) {
    case 'padded': return String(Math.round(value)).padStart(2, '0')
    case 'compact': return formatCompact(value)
    case 'usdCompact': return formatUsdCompact(value)
    case 'percent': return formatPercent(value)
    case 'decimal1': return `${value.toFixed(1)}%`
    default: return Math.round(value).toLocaleString('en-US')
  }
}

/** Counts a catalogue value up once when it enters view; respects reduced-motion preferences. */
export function AnimatedValue({ value, format = 'integer', className }: { value: number; format?: AnimatedValueFormat; className?: string }) {
  const [displayValue, setDisplayValue] = useState(0)
  const elementRef = useRef<HTMLSpanElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element || startedRef.current) return

    let frame = 0
    let observer: IntersectionObserver | undefined
    const start = () => {
      if (startedRef.current) return
      startedRef.current = true

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setDisplayValue(value)
        return
      }

      const duration = 1050
      const startTime = performance.now()
      const tick = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 4)
        setDisplayValue(value * eased)
        if (progress < 1) frame = requestAnimationFrame(tick)
        else setDisplayValue(value)
      }
      frame = requestAnimationFrame(tick)
    }

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          start()
          observer?.disconnect()
        }
      }, { threshold: 0.35 })
      observer.observe(element)
    } else {
      start()
    }

    return () => {
      observer?.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value])

  return <span ref={elementRef} className={className} aria-label={formatValue(value, format)}>{formatValue(displayValue, format)}</span>
}
