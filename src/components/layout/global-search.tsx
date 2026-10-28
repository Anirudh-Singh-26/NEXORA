import {
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  CornerDownLeft,
  Coins,
  Compass,
  Image as ImageIcon,
  Layers3,
  Network,
  Search,
  Settings2,
  type LucideIcon,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { searchCatalog } from '@/data/selectors'
import { globalSearchPages } from '@/data/catalog'
import { ease } from '@/lib/motion'
import { useUiStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'

type Entry = { id: string; group: string; title: string; meta: string; path: string; icon: LucideIcon }

const pageIcons = { compass: Compass, layers: Layers3, coins: Coins, network: Network, bookmark: Bookmark, calendar: CalendarDays, settings: Settings2 }
const PAGES: Entry[] = globalSearchPages.map((page) => ({ ...page, icon: pageIcons[page.iconKey] }))


export function GlobalSearch() {
  const open = useUiStore((s) => s.searchOpen)
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(!open)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setSearchOpen])

  const results = useMemo(() => searchCatalog(query), [query])

  // One flat, ordered list drives both rendering and keyboard navigation.
  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase()
    const pages = q ? PAGES.filter((p) => p.title.toLowerCase().includes(q)) : PAGES
    // Idle palette: pages first, then a short list of suggestions. Typing: matches first, pages last.
    const LIMIT = q ? 5 : 3
    const list: Entry[] = [
      ...results.collections.slice(0, LIMIT).map((c) => ({ id: `c-${c.id}`, group: 'Collections', title: c.name, meta: `${c.creator} · ${c.networkId}`, path: `/collections/${c.slug}`, icon: Layers3 })),
      ...results.tokens.slice(0, LIMIT).map((t) => ({ id: `t-${t.id}`, group: 'Tokens', title: t.name, meta: `${t.ticker} · ${t.networkId}`, path: `/tokens/${t.id}`, icon: Coins })),
      ...results.assets.slice(0, LIMIT).map((a) => ({ id: `a-${a.id}`, group: 'NFT assets', title: a.name, meta: `${a.collectionName} · #${a.tokenId}`, path: `/assets/${a.id}`, icon: ImageIcon })),
      ...results.projects.slice(0, LIMIT).map((p) => ({ id: `pr-${p.id}`, group: 'Projects', title: p.name, meta: `${p.category} · ${p.networkId}`, path: '/ecosystems', icon: Network })),
      ...results.campaigns.slice(0, LIMIT).map((c) => ({ id: `cm-${c.id}`, group: 'Campaigns', title: c.title, meta: `${c.status} · ${c.startsAt}`, path: '/drops', icon: CalendarDays })),
      ...results.airdrops.slice(0, LIMIT).map((d) => ({ id: `ad-${d.id}`, group: 'Airdrops', title: d.title, meta: `${d.status} · ${d.networkId}`, path: '/drops', icon: CalendarDays })),
    ]
    return q ? [...list, ...pages] : [...pages, ...list.filter((e) => e.group === 'Collections' || e.group === 'Tokens')]
  }, [results, query])

  useEffect(() => setActive(0), [query, open])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const close = () => { setSearchOpen(false); setQuery('') }
  const go = (path: string) => { close(); navigate(path) }

  const onInputKey = (event: React.KeyboardEvent) => {
    if (!entries.length) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => (i + 1) % entries.length) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => (i - 1 + entries.length) % entries.length) }
    else if (event.key === 'Enter') { event.preventDefault(); go(entries[active].path) }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setSearchOpen(next); if (!next) setQuery('') }}>
      <DialogContent showClose={false} className="max-w-2xl gap-0 overflow-hidden border-line/80 bg-raised p-0 shadow-pop">
        <DialogTitle className="sr-only">Search NEXORA</DialogTitle>
        <DialogDescription className="sr-only">Search the local demo catalog or jump to a page. Use arrow keys and Enter.</DialogDescription>

        <div className="flex items-center gap-3 border-b border-line/80 px-4">
          <Search className="size-4 shrink-0 text-copper" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search collections, tokens, NFTs, projects…"
            aria-label="Search"
            role="combobox"
            aria-expanded
            aria-controls="nx-search-list"
            aria-activedescendant={entries[active] ? `nx-opt-${entries[active].id}` : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-mute/70"
          />
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-mute sm:inline">ESC</kbd>
        </div>

        <div ref={listRef} id="nx-search-list" role="listbox" className="max-h-[min(60vh,470px)] overflow-y-auto p-2">
          {entries.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Search className="mx-auto size-5 text-mute" />
              <p className="mt-3 text-sm font-medium">No matching signal</p>
              <p className="mt-1 text-xs text-mute">Try a token ticker, collection name, project, or asset ID.</p>
            </div>
          ) : (
            entries.map((entry, index) => {
              const Icon = entry.icon
              const showGroup = index === 0 || entries[index - 1].group !== entry.group
              const isActive = index === active
              return (
                <div key={entry.id} role="presentation">
                  {showGroup ? (
                    <p className="px-2.5 pb-1 pt-3 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-mute/80 first:pt-1.5">{entry.group}</p>
                  ) : null}
                  <motion.button
                    type="button"
                    role="option"
                    id={`nx-opt-${entry.id}`}
                    aria-selected={isActive}
                    data-index={index}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, ease, delay: Math.min(index, 7) * 0.018 }}
                    onMouseMove={() => setActive(index)}
                    onClick={() => go(entry.path)}
                    className={cn(
                      'relative flex w-full min-w-0 items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-100',
                      isActive ? 'bg-inset' : 'bg-transparent',
                    )}
                  >
                    {isActive ? <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-copper" /> : null}
                    <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md border bg-canvas/60 transition-colors', isActive ? 'border-copper/40 text-copper' : 'border-line text-mute')}>
                      <Icon className="size-3.5" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{entry.title}</span>
                      <span className="block truncate text-[11px] text-mute">{entry.meta}</span>
                    </span>
                    {isActive ? <CornerDownLeft className="size-3.5 shrink-0 text-mute" /> : <ArrowUpRight className="size-3.5 shrink-0 text-mute/0" />}
                  </motion.button>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line/80 bg-canvas/40 px-4 py-2 text-[10.5px] text-mute">
          <span className="truncate">Local demo catalog · no live chain queries</span>
          <span className="hidden shrink-0 items-center gap-3 sm:flex">
            <span><kbd className="rounded border border-line px-1 font-mono">↑</kbd> <kbd className="rounded border border-line px-1 font-mono">↓</kbd> navigate</span>
            <span><kbd className="rounded border border-line px-1 font-mono">↵</kbd> open</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
