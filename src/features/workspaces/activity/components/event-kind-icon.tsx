import type { ReactNode } from 'react'
import { ArrowDownLeft, Image as ImageIcon, Repeat2 } from 'lucide-react'
import type { EvmKind } from '@/lib/wallet-activity/wallet-activity'

export const EVM_KIND_ICON: Record<EvmKind, ReactNode> = {
  native: <Repeat2 size={14} />,
  token: <ArrowDownLeft size={14} />,
  nft: <ImageIcon size={14} />,
}
