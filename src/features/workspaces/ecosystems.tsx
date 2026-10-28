import { useMemo, useState } from 'react'
import { AtlasRule, EcosystemsHeader } from '@/features/workspaces/ecosystems/components/ecosystems-header'
import { NetworkAtlas, NetworkRail } from '@/features/workspaces/ecosystems/components/network-atlas'
import { NetworkComparison } from '@/features/workspaces/ecosystems/components/network-comparison'
import { NetworkDossier } from '@/features/workspaces/ecosystems/components/network-dossier'
import { ProjectExplorer } from '@/features/workspaces/ecosystems/components/project-explorer'
import { buildAtlas, type NetworkSelection } from '@/features/workspaces/ecosystems/atlas-data'
import './ecosystems/ecosystems-page.css'

/**
 * Ecosystems: a network atlas. Choose a network spatially (atlas), in a chip
 * rail, or from the comparison bars; the dossier and project lanes follow the
 * focus. Owns its page heading (WorkspacePageFrame skips the generic one).
 */
export function EcosystemsWorkspace() {
  const [selected, setSelected] = useState<NetworkSelection>('all')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  const atlas = useMemo(() => buildAtlas(), [])
  const entry = atlas.find((a) => a.network.id === selected)

  // Category chips belong to the focused scope; reset them when the scope changes.
  const select = (id: NetworkSelection) => { setSelected(id); setCategory('all') }

  return (
    <div className="nxe-page">
      <EcosystemsHeader atlas={atlas} />
      <AtlasRule />
      <section className="nxe-stage" aria-label="Network atlas">
        <div className="nxe-stage__map">
          <NetworkAtlas atlas={atlas} selected={selected} onSelect={select} />
          <NetworkRail atlas={atlas} selected={selected} onSelect={select} />
        </div>
        <NetworkDossier atlas={atlas} entry={entry} />
      </section>
      <NetworkComparison atlas={atlas} selected={selected} onSelect={select} />
      <ProjectExplorer atlas={atlas} selected={selected} onSelect={select} query={query} onQuery={setQuery} category={category} onCategory={setCategory} />
    </div>
  )
}
