import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

export function ChangeValue({ value }: { value: number }) {
  return (
    <span className={cn('tabular-nums', value >= 0 ? 'text-gain' : 'text-loss')}>
      {formatPercent(value)}
    </span>
  )
}
