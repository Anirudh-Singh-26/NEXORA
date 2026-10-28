import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type WatchlistState = {
  tokenIds: string[]
  collectionIds: string[]
  assetIds: string[]
  campaignIds: string[]
  toggleToken: (id: string) => void
  toggleCollection: (id: string) => void
  toggleAsset: (id: string) => void
  toggleCampaign: (id: string) => void
  isTokenWatched: (id: string) => boolean
  isCollectionWatched: (id: string) => boolean
  isAssetWatched: (id: string) => boolean
  isCampaignWatched: (id: string) => boolean
}

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      tokenIds: ['nex', 'eth'],
      collectionIds: ['lumen-relics'],
      assetIds: [],
      campaignIds: [],
      toggleToken: (id) => set({ tokenIds: toggleId(get().tokenIds, id) }),
      toggleCollection: (id) =>
        set({ collectionIds: toggleId(get().collectionIds, id) }),
      toggleAsset: (id) => set({ assetIds: toggleId(get().assetIds, id) }),
      toggleCampaign: (id) => set({ campaignIds: toggleId(get().campaignIds, id) }),
      isTokenWatched: (id) => get().tokenIds.includes(id),
      isCollectionWatched: (id) => get().collectionIds.includes(id),
      isAssetWatched: (id) => get().assetIds.includes(id),
      isCampaignWatched: (id) => get().campaignIds.includes(id),
    }),
    { name: 'nexora-watchlist' },
  ),
)
