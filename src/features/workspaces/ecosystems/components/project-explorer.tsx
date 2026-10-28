import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { MediaImage } from '@/components/shared/media-image'
import { getCollectionById } from '@/data/selectors'
import type { Project } from '@/data/types'
import { SearchField } from '@/features/workspaces/shared/search-field'
import { cn } from '@/lib/utils'
import type { AtlasEntry, NetworkSelection } from '@/features/workspaces/ecosystems/atlas-data'

function ProjectCard({ project, color }: { project: Project; color: string }) {
  const target = project.collectionId ? getCollectionById(project.collectionId) : undefined
  return (
    <article className="nxe-project" style={{ ['--eco-accent' as string]: color }}>
      <MediaImage src={project.cover} alt={project.name} className="nxe-project__cover" fallbackLabel={project.name.slice(0, 2)} />
      <div className="nxe-project__body">
        <div className="nxe-project__top">
          <h3>{project.name}</h3>
          <span>{project.category}</span>
        </div>
        <p>{project.tagline}</p>
        <Link to={target ? `/collections/${target.slug}` : '/collections'} className="nxe-project__link">
          {target ? `Explore ${target.name}` : 'Explore related catalog'} <ArrowRight size={13} />
        </Link>
      </div>
    </article>
  )
}

/** Projects grouped into network lanes (all) or a single focused lane. */
export function ProjectExplorer({ atlas, selected, onSelect, query, onQuery, category, onCategory }: {
  atlas: AtlasEntry[]
  selected: NetworkSelection
  onSelect: (id: NetworkSelection) => void
  query: string
  onQuery: (v: string) => void
  category: string
  onCategory: (v: string) => void
}) {
  const q = query.trim().toLowerCase()
  const scope = atlas.filter((a) => selected === 'all' || a.network.id === selected)
  const categories = [...new Set(scope.flatMap((a) => a.projects.map((p) => p.category)))].sort()

  const lanes = scope
    .map((a) => ({
      entry: a,
      projects: a.projects.filter((p) => (category === 'all' || p.category === category) && `${p.name} ${p.tagline} ${p.category}`.toLowerCase().includes(q)),
    }))
    .filter((lane) => lane.projects.length > 0)
  const count = lanes.reduce((s, l) => s + l.projects.length, 0)
  const focusedName = selected === 'all' ? null : atlas.find((a) => a.network.id === selected)?.network.name
  const reset = () => { onQuery(''); onCategory('all'); onSelect('all') }

  return (
    <section className="nxe-explorer" aria-labelledby="nxe-explorer-title">
      <header className="nxe-section-head nxe-section-head--explorer">
        <h2 id="nxe-explorer-title">Projects{focusedName ? ` on ${focusedName}` : ' by network'}</h2>
        <p className="nxe-count" aria-live="polite"><b>{count}</b> {count === 1 ? 'project' : 'projects'}</p>
      </header>
      <div className="nxe-explorer__bar nx-sticky-bar">
        <SearchField value={query} onChange={onQuery} placeholder="Search protocols and projects" label="Search projects" className="min-w-[200px] flex-1 sm:max-w-sm" />
        {categories.length > 1 ? (
          <div className="nxe-cats" role="group" aria-label="Project category">
            <button type="button" aria-pressed={category === 'all'} onClick={() => onCategory('all')} className={cn('nxe-cat', category === 'all' && 'is-active')}>All</button>
            {categories.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => onCategory(c)} className={cn('nxe-cat', category === c && 'is-active')}>{c}</button>
            ))}
          </div>
        ) : null}
      </div>

      {lanes.length === 0 ? (
        <EmptyState title="No projects match" body="Try another network or clear the search." action={<button type="button" onClick={reset} className="text-sm text-copper hover:underline">Show all projects</button>} />
      ) : (
        <div className="nxe-lanes">
          {lanes.map(({ entry, projects }) => (
            <div key={entry.network.id} className="nxe-lane" style={{ ['--eco-accent' as string]: entry.network.color }}>
              <header className="nxe-lane__head">
                <i aria-hidden />
                <h3>{entry.network.name}</h3>
                <span>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</span>
                {selected === 'all' ? <button type="button" onClick={() => onSelect(entry.network.id)}>Focus</button> : null}
              </header>
              <div className="nxe-lane__grid">
                {projects.map((p) => <ProjectCard key={p.id} project={p} color={entry.network.color} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
