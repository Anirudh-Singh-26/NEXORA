import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChangeValue } from '@/components/shared/change-value'
import { Sparkline } from '@/components/shared/sparkline'
import { catalog } from '@/data/catalog'
import { getTokenImage } from '@/data/token-image-map'
import { RailSourceTag } from '@/features/discover/rail-source-tag'
import { useLiveTokens } from '@/hooks/use-live-tokens'
import { pickRailTokens } from '@/lib/discover/rails'
import { formatUsd, formatUsdCompact } from '@/lib/format'
import { MARKET_SOURCE } from '@/lib/market-data/coingecko'

/**
 * A compact, data-driven token marquee. It intentionally travels left-to-right.
 * Shows live CoinGecko quotes (shared 60s client cache) once loaded. Until then, or if the provider fails, it shows the
 * demo catalogue under an explicit "Illustrative data" label; failed live requests are never presented as real data.
 */
export function MovingTokenRail() {
  const live = useLiveTokens()
  const isLive = live.status === 'ready' && live.tokens.length > 0
  const tokens = pickRailTokens(isLive ? live.tokens : catalog.tokens, 8)

  if (!tokens.length) return null

  const renderToken = (token: (typeof tokens)[number], duplicate = false) => (
    <Link
      key={`${duplicate ? 'duplicate-' : ''}${token.id}`}
      to={`/tokens/${token.id}`}
      tabIndex={duplicate ? -1 : undefined}
      className="nx-token-rail__card group"
      aria-label={duplicate ? undefined : `${token.name} (${token.ticker}), ${formatUsd(token.price)}, ${token.change24h >= 0 ? 'up' : 'down'} ${Math.abs(token.change24h).toFixed(2)} percent in 24 hours`}
    >
      <img
        src={getTokenImage(token.id) ?? `/images/tokens/${token.id}.svg`}
        alt=""
        aria-hidden="true"
        className="nx-token-rail__glyph"
        loading="lazy"
        decoding="async"
      />
      <span className="nx-token-rail__copy">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold tracking-tight text-ink transition-colors group-hover:text-copper">{token.name}</span>
          <span className="shrink-0 font-mono text-[9px] text-mute">{token.ticker}</span>
        </span>
        <span className="mt-1.5 flex min-w-0 items-baseline gap-2 text-[11px]">
          <span className="truncate font-mono tabular-nums text-mute">{formatUsdCompact(token.marketCap)}</span>
          <ChangeValue value={token.change24h} />
        </span>
      </span>
      <Sparkline data={token.sparkline} positive={token.change24h >= 0} className="nx-token-rail__sparkline" />
      <ArrowUpRight aria-hidden className="nx-token-rail__arrow size-3.5 shrink-0 text-mute/70" />
    </Link>
  )

  return (
    <section className="nx-token-rail" aria-label="Trending tokens">
      <RailSourceTag
        state={isLive ? 'live' : live.status === 'error' ? 'unavailable' : 'loading'}
        label="token prices" source={MARKET_SOURCE.name} sourceUrl={MARKET_SOURCE.url} updatedAt={live.snapshot?.fetchedAt} note={live.error}
      />
      <div className="nx-token-rail__viewport" role="region" aria-label="Automatically scrolling trending tokens">
        <div className="nx-token-rail__track">
          <div className="nx-token-rail__group">
            {tokens.map((token) => renderToken(token))}
          </div>
          <div className="nx-token-rail__group" aria-hidden="true">
            {tokens.map((token) => renderToken(token, true))}
          </div>
        </div>
      </div>
    </section>
  )
}
