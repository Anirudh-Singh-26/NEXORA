import type { ReactNode } from 'react'
import { ArrowDownUp, Compass, ScanLine, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOOL_CATEGORIES, TOOLS, type ToolCategory, type ToolId, type ToolMeta } from '@/features/workspaces/tools/tools-directory'

const TOOL_ICON: Record<ToolId, ReactNode> = {
  address: <ScanLine size={16} />,
  converter: <ArrowDownUp size={16} />,
  lookup: <Compass size={16} />,
}

/** Searchable, category-filtered index of the tools. Selecting one opens it in the workbench. */
export function ToolDirectory({
  tools, activeId, onSelect, category, onCategory,
}: {
  tools: ToolMeta[]
  activeId: ToolId | undefined
  onSelect: (id: ToolId) => void
  category: ToolCategory | 'all'
  onCategory: (value: ToolCategory | 'all') => void
}) {
  const groups = TOOL_CATEGORIES.map((c) => ({ category: c, items: tools.filter((t) => t.category === c) })).filter((g) => g.items.length > 0)

  return (
    <nav className="nxu-dir" aria-label="Tool directory">
      <div className="nxu-dir__cats" role="group" aria-label="Tool category">
        <button type="button" aria-pressed={category === 'all'} onClick={() => onCategory('all')} className="nxu-cat">All <b>{TOOLS.length}</b></button>
        {TOOL_CATEGORIES.map((c) => (
          <button key={c} type="button" aria-pressed={category === c} onClick={() => onCategory(category === c ? 'all' : c)} className="nxu-cat">
            {c} <b>{TOOLS.filter((t) => t.category === c).length}</b>
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <section key={g.category} className="nxu-group" aria-label={g.category}>
          <h2 className="nxu-group__title">{g.category}</h2>
          <ul>
            {g.items.map((tool) => (
              <li key={tool.id}>
                <button type="button" aria-current={activeId === tool.id ? 'true' : undefined} onClick={() => onSelect(tool.id)} className={cn('nxu-tool', activeId === tool.id && 'is-active')}>
                  <span className="nxu-tool__icon">{TOOL_ICON[tool.id]}</span>
                  <span className="nxu-tool__text">
                    <b>{tool.title}</b>
                    <small>{tool.input} → {tool.output}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  )
}

/** Workbench frame for one tool: what it is, what it takes, what it returns. */
export function ToolPanel({ tool, hidden, children }: { tool: ToolMeta; hidden: boolean; children: ReactNode }) {
  return (
    <section hidden={hidden} className="nxu-panel" aria-labelledby={`nxu-${tool.id}-title`}>
      <header className="nxu-panel__head">
        <span className="nxu-panel__icon">{TOOL_ICON[tool.id]}</span>
        <div className="min-w-0">
          <p className="nxu-panel__cat">{tool.category}<span>{tool.badge}</span></p>
          <h2 id={`nxu-${tool.id}-title`} className="nxu-panel__title">{tool.title}</h2>
          <p className="nxu-panel__blurb">{tool.summary}</p>
        </div>
      </header>
      <dl className="nxu-panel__io">
        <div><dt>Input</dt><dd>{tool.input}</dd></div>
        <div><dt>Output</dt><dd>{tool.output}</dd></div>
        <div><dt>Runs</dt><dd><ShieldCheck size={12} /> In this browser</dd></div>
      </dl>
      <div className="nxu-panel__body">{children}</div>
    </section>
  )
}
