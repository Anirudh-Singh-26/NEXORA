import type { ReactNode } from 'react'
import type { WorkspaceId } from '@/features/workspaces/workspace-types'

const titleMap: Record<WorkspaceId, { eyebrow: string; title: string; description: string }> = {
  ecosystems: { eyebrow: 'Network atlas', title: 'Ecosystems', description: 'Explore the networks and projects shaping this illustrative Web3 catalog.' },
  drops: { eyebrow: 'Campaign calendar', title: 'Drops & airdrops', description: 'Track campaign states in a fictional dataset. Listings are not endorsements or eligibility guarantees.' },
  activity: { eyebrow: 'Signal feed', title: 'Activity', description: 'A curated stream of simulated events from the local demo catalog.' },
  tools: { eyebrow: 'Utilities', title: 'Web3 tools', description: 'Small local utilities for inspecting and validating common Web3 inputs.' },
  assistant: { eyebrow: 'Nexora intelligence', title: 'AI assistant', description: 'A local demo assistant. Responses are scripted and do not query live chains or an AI service.' },
  swap: { eyebrow: 'Execution sandbox', title: 'Swap simulator', description: 'Preview a fictional token exchange. No wallet connection or blockchain transaction is performed.' },
  rewards: { eyebrow: 'Participation', title: 'Rewards', description: 'Illustrative points and progress only. These rewards have no monetary value.' },
  profile: { eyebrow: 'Your workspace', title: 'Profile', description: 'Edit a local demo profile. No production account or identity system is connected.' },
  settings: { eyebrow: 'Preferences', title: 'Settings', description: 'Preferences are stored in this browser only.' },
  notifications: { eyebrow: 'Inbox', title: 'Notifications', description: 'Example product notifications with local read-state interactions.' },
  help: { eyebrow: 'Field guide', title: 'Help & resources', description: 'Understand the prototype, browse key concepts, and use Web3 tools more safely.' },
}

/** Pages that render their own heading inside their workspace component. */
const OWN_HEADING: WorkspaceId[] = ['tools', 'help', 'ecosystems', 'drops', 'activity']

function PageHeader({ page }: { page: WorkspaceId }) {
  const item = titleMap[page]
  return <header className="max-w-3xl"><p className="text-[11px] uppercase tracking-[0.28em] text-copper">{item.eyebrow}</p><h1 className="mt-2 font-display text-4xl md:text-5xl">{item.title}</h1><p className="mt-3 text-sm leading-6 text-mute">{item.description}</p><p className="mt-4 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[11px] uppercase tracking-wider text-copper"><span className="size-1.5 rounded-full bg-copper" /> Demo environment · sample data</p></header>
}

export function WorkspacePageFrame({ page, children }: { page: WorkspaceId; children: ReactNode }) {
  return <div className="space-y-8">{OWN_HEADING.includes(page) ? null : <PageHeader page={page} />}{children}</div>
}
