import { DiscoverHero } from '@/components/hero/discover-hero'
import { CreatorStudios } from '@/features/discover/creator-studios'
import { EmergingCollections } from '@/features/discover/emerging-collections'
import { LaunchCalendar } from '@/features/discover/launch-calendar'
import { MovingNftRail } from '@/features/discover/moving-nft-rail'
import { MovingTokenRail } from '@/features/discover/moving-token-rail'
import { NetworkExplorer } from '@/features/discover/network-explorer'
import { ObservatoryFooter } from '@/features/discover/observatory-footer'
import { CategoryMosaic, Spotlight, TokenTape, TrendingShelf } from '@/features/discover/sections'
import './discover-expansion.css'

/**
 * Main Discover landing page.
 * Rhythm: hero + NFT rail → editorial pick → token rail → trending shelf (compact) →
 * launch calendar (data-rich) → network explorer (interactive) →
 * category bento → emerging grid (staggered) → studios → token tape → footer.
 */
export function DiscoverPage() {
  return (
    <div className="space-y-7 md:space-y-8">
      <DiscoverHero />
      <MovingNftRail />
      <Spotlight />
      <MovingTokenRail />
      <TrendingShelf />
      <LaunchCalendar />
      <NetworkExplorer />
      <CategoryMosaic />
      <EmergingCollections />
      <CreatorStudios />
      <TokenTape />
      <ObservatoryFooter />
    </div>
  )
}

export default DiscoverPage
