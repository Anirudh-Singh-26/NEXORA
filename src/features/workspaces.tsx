import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { WorkspacePageFrame } from '@/features/workspaces/shared/workspace-page-frame'
import { EcosystemsWorkspace } from '@/features/workspaces/ecosystems'
import { DropsWorkspace } from '@/features/workspaces/drops'
import { ActivityWorkspace } from '@/features/workspaces/activity'
import { SwapWorkspace } from '@/features/workspaces/swap'
import { RewardsWorkspace } from '@/features/workspaces/rewards'
import { NotificationsWorkspace } from '@/features/workspaces/notifications'
import { AssistantWorkspace } from '@/features/workspaces/assistant'
import { ToolsWorkspace } from '@/features/workspaces/tools'
import { ProfileWorkspace } from '@/features/workspaces/profile'
import { SettingsWorkspace } from '@/features/workspaces/settings'
import { HelpWorkspace } from '@/features/workspaces/help'
export { AssetDetailPage } from '@/features/workspaces/asset-detail'

export type { WorkspaceId } from '@/features/workspaces/workspace-types'
import type { WorkspaceId } from '@/features/workspaces/workspace-types'

export function WorkspacePage({ page }: { page: WorkspaceId }) {
  useEffect(() => {
    const motionPreference = localStorage.getItem('nexora-reduced-motion')
    const compactPreference = localStorage.getItem('nexora-compact')
    if (motionPreference !== null) document.documentElement.dataset.motion = motionPreference === 'true' ? 'reduced' : 'full'
    if (compactPreference !== null) document.documentElement.dataset.compact = compactPreference
  }, [])

  let content: ReactNode = null
  switch (page) {
    case 'ecosystems': content = <EcosystemsWorkspace />; break
    case 'drops': content = <DropsWorkspace />; break
    case 'activity': content = <ActivityWorkspace />; break
    case 'tools': content = <ToolsWorkspace />; break
    case 'assistant': content = <AssistantWorkspace />; break
    case 'swap': content = <SwapWorkspace />; break
    case 'rewards': content = <RewardsWorkspace />; break
    case 'profile': content = <ProfileWorkspace />; break
    case 'settings': content = <SettingsWorkspace />; break
    case 'notifications': content = <NotificationsWorkspace />; break
    case 'help': content = <HelpWorkspace />; break
  }
  return <WorkspacePageFrame page={page}>{content}</WorkspacePageFrame>
}
