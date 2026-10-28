import { getNetwork } from '@/data/selectors'
import type { NetworkId } from '@/data/types'
import { cn } from '@/lib/utils'

export function NetworkChip({ id, className }: { id: NetworkId; className?: string }) {
  const network = getNetwork(id)
  if (!network) return null

  return (
    <span
      className={cn(
        'nx-network-chip inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas/50 px-2 py-0.5 text-[11px] uppercase tracking-wider text-mute',
        className,
      )}
    >
      <span className="size-1.5 rounded-full" style={{ background: network.color }} />
      {network.shortName}
    </span>
  )
}
