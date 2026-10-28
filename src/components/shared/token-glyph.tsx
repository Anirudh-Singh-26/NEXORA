import { getNetwork } from '@/data/selectors'
import { getTokenImage } from '@/data/token-image-map'
import type { Token } from '@/data/types'
import { cn } from '@/lib/utils'

/** Shared token artwork used consistently across tables, details, tools, and rails. */
export function TokenGlyph({
  token,
  className,
}: {
  token: Pick<Token, 'id' | 'ticker' | 'networkId'>
  className?: string
}) {
  const color = getNetwork(token.networkId)?.color ?? '#a99aff'
  const image = getTokenImage(token.id)

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border',
        className,
      )}
      style={{ color, borderColor: `${color}40`, background: `${color}14` }}
    >
      {image ? (
        <img
          src={image}
          alt={`${token.ticker} token`}
          className="size-full rounded-[inherit] object-contain"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="font-mono text-[10px] font-medium">{token.ticker.slice(0, 3)}</span>
      )}
    </span>
  )
}
