import { NetworkChip } from '@/components/shared/network-chip'
import type { Campaign } from '@/data/types'
import { formatCompact } from '@/lib/format'
import { describeMint } from '@/features/workspaces/drops/drops-data'

/** Network, reward, supply and mint price: only what the campaign actually carries. */
export function CampaignFacts({ campaign }: { campaign: Campaign }) {
  const mint = describeMint(campaign)
  return (
    <ul className="nxd-facts">
      {campaign.networkId ? <li><NetworkChip id={campaign.networkId} /></li> : null}
      {campaign.rewardType ? <li className="nxd-fact"><span>Reward</span><b className="capitalize">{campaign.rewardType}</b></li> : null}
      {campaign.supply !== undefined ? <li className="nxd-fact"><span>Supply</span><b>{formatCompact(campaign.supply)}</b></li> : null}
      {mint ? <li className="nxd-fact"><span>Mint</span><b>{mint}</b></li> : null}
      {campaign.isIllustrative ? <li className="nxd-fact is-demo"><b>Illustrative</b></li> : null}
    </ul>
  )
}
