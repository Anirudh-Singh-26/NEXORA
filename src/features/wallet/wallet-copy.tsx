import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, CircleAlert, Copy } from 'lucide-react'

export type CopyStatus = { address: string; ok: boolean } | null

function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

/** Copies a PUBLIC address and reports success or failure. Failure is surfaced, never swallowed. */
export function useCopyAddress() {
  const [status, setStatus] = useState<CopyStatus>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = useCallback(async (address: string) => {
    window.clearTimeout(timer.current)
    let ok = false
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(address); ok = true }
    } catch { ok = false }
    if (!ok) ok = legacyCopy(address)
    setStatus({ address, ok })
    timer.current = window.setTimeout(() => setStatus(null), 2400)
  }, [])

  return { status, copy }
}

export type CopyController = ReturnType<typeof useCopyAddress>

export function copyMessage(status: CopyStatus): string {
  if (!status) return ''
  return status.ok ? 'Address copied to clipboard.' : 'Could not copy automatically. Select the address and copy it manually.'
}

export function CopyButton({ address, copy, label, className = '' }: { address: string; copy: CopyController; label: string; className?: string }) {
  const state = copy.status?.address === address ? (copy.status.ok ? 'ok' : 'fail') : 'idle'
  return (
    <button type="button" className={`wlt-copy ${state !== 'idle' ? `is-${state}` : ''} ${className}`} onClick={() => void copy.copy(address)} aria-label={`Copy ${label} address`}>
      {state === 'ok' ? <Check size={14} aria-hidden="true" /> : state === 'fail' ? <CircleAlert size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span>{state === 'ok' ? 'Copied' : state === 'fail' ? 'Copy failed' : 'Copy'}</span>
    </button>
  )
}
