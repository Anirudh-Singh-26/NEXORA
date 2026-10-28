import { useEffect, useState } from 'react'

export function useSimulatedLoad(duration = 420) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), duration)
    return () => window.clearTimeout(timer)
  }, [duration])

  return ready
}
