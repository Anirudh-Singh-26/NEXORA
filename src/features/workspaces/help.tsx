import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { BookOpen, LifeBuoy, Plus, ArrowRight, Check, ChevronRight, Compass, Send, ShieldCheck, ExternalLink, ShieldAlert, TrendingUp, Wrench } from 'lucide-react'
import { Segmented } from '@/components/shared/segmented'
import { helpArticles, helpCategorySeeds, helpFaqSeeds, helpReadingSeeds } from '@/data/catalog'
import type { HelpCategoryId } from '@/data/nexora-data'
import { dur, ease } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/empty-state'
import { SearchField } from '@/features/workspaces/shared/search-field'

const helpCategoryIcons = { start: <Compass className="size-5" />, safety: <ShieldCheck className="size-5" />, markets: <TrendingUp className="size-5" />, tools: <Wrench className="size-5" /> } as const


const helpCategories = helpCategorySeeds.map((item) => ({ ...item, icon: helpCategoryIcons[item.id] }))


export function HelpWorkspace() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<HelpCategoryId | 'all'>('all')
  const [openArticle, setOpenArticle] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [topic, setTopic] = useState('Getting started')
  const [message, setMessage] = useState('')
  const [previewed, setPreviewed] = useState(false)
  const resultsRef = useRef<HTMLElement>(null)

  const q = query.trim().toLowerCase()
  const articles = useMemo(() => helpArticles.filter((a) => (category === 'all' || a.category === category) && (!q || `${a.title} ${a.summary} ${a.tags.join(' ')} ${a.body.join(' ')}`.toLowerCase().includes(q))), [q, category])
  const faqs = useMemo(() => helpFaqSeeds.map((f, i) => ({ ...f, i })).filter((f) => !q || `${f.q} ${f.a}`.toLowerCase().includes(q)), [q])
  const counts = useMemo(() => Object.fromEntries(helpCategories.map((c) => [c.id, helpArticles.filter((a) => a.category === c.id).length])) as Record<HelpCategoryId, number>, [])

  const pickCategory = (id: HelpCategoryId | 'all') => {
    setCategory(id)
    setOpenArticle(null)
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const resetAll = () => { setQuery(''); setCategory('all') }

  return (
    <div className="space-y-10">
      {/* ── Hero ───────────────────────────────────────────── */}
      <header className="nx-hero relative overflow-hidden rounded-2xl border border-line/80 px-5 py-8 md:px-10 md:py-12">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-copper/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-sage/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 lg:block">
          <div className="relative size-56">
            {[0, 1, 2].map((r) => <motion.span key={r} className="absolute rounded-full border border-copper/20" style={{ inset: r * 28 }} animate={{ opacity: [0.35, 0.8, 0.35] }} transition={{ duration: 5, delay: r * 0.9, repeat: Infinity, ease: 'easeInOut' }} />)}
            <span className="absolute inset-[84px] flex items-center justify-center rounded-full border border-copper/30 bg-copper/10 text-copper"><BookOpen className="size-6" /></span>
          </div>
        </div>
        <div className="relative max-w-2xl">
          <p className="nx-kicker">Field guide</p>
          <h1 className="mt-3 font-display text-[clamp(2.1rem,5vw,3.6rem)] font-semibold leading-[0.98] tracking-[-0.045em]">How can we <span className="bg-gradient-to-r from-copper to-sage bg-clip-text text-transparent">help</span> you navigate?</h1>
          <p className="mt-4 max-w-xl text-[13.5px] leading-6 text-mute">Understand the prototype, browse key concepts, and use Web3 tools more safely. Search guides and answers below.</p>
          <SearchField value={query} onChange={setQuery} placeholder="Search guides, safety tips, and FAQs…" label="Search help articles and FAQs" className="mt-6 h-12 max-w-xl [&_input]:text-[14px]" />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-mute">
            <span>Popular:</span>
            {['seed phrase', 'airdrop', 'watchlist', 'swap'].map((s) => <button key={s} type="button" onClick={() => setQuery(s)} className="rounded-full border border-line px-2.5 py-1 transition-colors hover:border-copper/40 hover:text-ink">{s}</button>)}
          </div>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[11px] uppercase tracking-wider text-copper"><span className="size-1.5 rounded-full bg-copper" /> Demo environment · sample data</p>
        </div>
      </header>

      {/* ── Category index ─────────────────────────────────── */}
      <section aria-label="Resource categories">
        <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr_1fr] lg:grid-rows-2">
          {helpCategories.map((c, i) => {
            const active = category === c.id
            return (
              <motion.button key={c.id} type="button" onClick={() => pickCategory(active ? 'all' : c.id)} aria-pressed={active}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.slow, ease, delay: i * 0.05 }}
                className={cn('nx-panel nx-interactive group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl p-5 text-left', i === 0 ? 'lg:row-span-2 lg:p-7' : '', i === 1 ? 'lg:col-span-1' : '', active && 'border-copper/50')}>
                <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-copper/5 blur-2xl transition-opacity group-hover:opacity-100" />
                <span className={cn('flex size-10 items-center justify-center rounded-xl border border-line bg-inset', c.tone)}>{c.icon}</span>
                <span className={cn('block', i === 0 ? 'mt-16' : 'mt-5')}>
                  <span className="flex items-center gap-2 font-display text-[19px] font-semibold tracking-tight">{c.label}<ArrowRight className="size-4 -translate-x-1 text-mute opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" /></span>
                  <span className="mt-1.5 block text-[12.5px] leading-5 text-mute">{c.blurb}</span>
                  <span className="mt-3 block font-mono text-[11px] tabular-nums text-mute">{counts[c.id]} guides{active ? ' · filtered' : ''}</span>
                </span>
              </motion.button>
            )
          })}
          <div className="nx-surface flex min-w-0 items-center gap-3 rounded-2xl p-5 lg:col-span-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-inset text-copper"><ShieldAlert className="size-5" /></span>
            <p className="text-[12.5px] leading-5 text-mute"><span className="text-ink">Safety first.</span> No one from NEXORA will ever ask for your seed phrase or private key. This prototype never requests them.</p>
          </div>
        </div>
      </section>

      {/* ── Guides ─────────────────────────────────────────── */}
      <section ref={resultsRef} aria-label="Help guides" className="scroll-mt-24">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="nx-kicker">Guides</p>
            <h2 className="mt-1.5 text-[19px] font-semibold tracking-tight md:text-[21px]">{category === 'all' ? 'All guides' : helpCategories.find((c) => c.id === category)?.label}</h2>
          </div>
          <div className="flex min-w-0 max-w-full items-center gap-3">
            <div className="max-w-full overflow-x-auto"><Segmented<HelpCategoryId | 'all'> label="Filter guides by category" value={category} onChange={pickCategory} options={[{ value: 'all', label: 'All' }, ...helpCategories.map((c) => ({ value: c.id, label: c.label }))]} /></div>
          </div>
        </div>
        <p className="mb-3 font-mono text-[11px] tabular-nums text-mute" aria-live="polite">{articles.length} {articles.length === 1 ? 'guide' : 'guides'}{q ? ` matching “${query.trim()}”` : ''}</p>
        {articles.length === 0 ? (
          <EmptyState title="No guides match" body="Try a different keyword or clear the filters." action={<button type="button" onClick={resetAll} className="rounded-lg border border-line px-3 py-1.5 text-[12px] hover:border-copper/40">Clear search</button>} />
        ) : (
          <ul className="nx-surface divide-y divide-line/70 overflow-hidden rounded-2xl">
            {articles.map((a, i) => {
              const open = openArticle === a.id
              const cat = helpCategories.find((c) => c.id === a.category)!
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => setOpenArticle(open ? null : a.id)} aria-expanded={open} aria-controls={`help-${a.id}`} className="group flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-white/[0.025] md:px-5">
                    <span className="mt-0.5 hidden w-7 shrink-0 font-mono text-[11px] tabular-nums text-mute sm:block">{String(i + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-[14.5px] font-medium tracking-tight">{a.title}</span>
                        <span className={cn('inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]', cat.tone)}><span className="size-1 rounded-full bg-current" />{cat.label}</span>
                      </span>
                      <span className="mt-1 block text-[12.5px] leading-5 text-mute">{a.summary}</span>
                    </span>
                    <span className="mt-0.5 hidden shrink-0 font-mono text-[11px] text-mute sm:block">{a.read}</span>
                    <ChevronRight className={cn('mt-1 size-4 shrink-0 text-mute transition-transform duration-200 group-hover:text-ink', open && 'rotate-90 text-copper')} />
                  </button>
                  {open ? (
                    <motion.div id={`help-${a.id}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.base, ease }} className="border-t border-line/60 bg-inset/40 px-4 py-4 sm:pl-16 md:pr-5">
                      <div className="max-w-2xl space-y-2.5 text-[13px] leading-6 text-mute">{a.body.map((p) => <p key={p}>{p}</p>)}</div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {a.tags.map((t) => <button key={t} type="button" onClick={() => setQuery(t)} className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-mute hover:border-copper/40 hover:text-ink">#{t}</button>)}
                        {a.link ? <Link to={a.link.to} className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-copper transition-colors hover:text-ink">{a.link.label} <ArrowRight className="size-3.5" /></Link> : null}
                      </div>
                    </motion.div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── FAQ + reading list ─────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section aria-label="Frequently asked questions" className="min-w-0">
          <p className="nx-kicker">FAQ</p>
          <h2 className="mb-4 mt-1.5 text-[19px] font-semibold tracking-tight md:text-[21px]">Quick answers</h2>
          {faqs.length === 0 ? <EmptyState title="No FAQ matches" body="No questions match this search." /> : (
            <div className="space-y-2">
              {faqs.map((f) => {
                const open = openFaq === f.i
                return (
                  <div key={f.q} className={cn('nx-panel overflow-hidden rounded-xl transition-colors', open && 'border-copper/40')}>
                    <h3>
                      <button type="button" onClick={() => setOpenFaq(open ? null : f.i)} aria-expanded={open} aria-controls={`faq-${f.i}`} className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-[13.5px] font-medium transition-colors hover:text-copper">
                        <span className="min-w-0">{f.q}</span>
                        <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-mute transition-transform duration-200', open && 'rotate-45 border-copper/50 text-copper')}><Plus className="size-3.5" /></span>
                      </button>
                    </h3>
                    {open ? <motion.p id={`faq-${f.i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: dur.base, ease }} className="px-4 pb-4 text-[12.5px] leading-6 text-mute">{f.a}</motion.p> : null}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <aside aria-label="External learning resources" className="min-w-0">
          <p className="nx-kicker">Reading list</p>
          <h2 className="mb-4 mt-1.5 text-[19px] font-semibold tracking-tight md:text-[21px]">External learning resources</h2>
          <p className="mb-3 text-[12.5px] leading-5 text-mute">Official documentation entry points. These open in a new tab.</p>
          <div className="space-y-2">
            {helpReadingSeeds.map((r) => (
              <a key={r.href} href={r.href} target="_blank" rel="noreferrer" className="nx-surface nx-interactive group flex items-center gap-3 rounded-xl p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-inset text-sage"><BookOpen className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-medium">{r.label}</span><span className="block text-[12px] leading-5 text-mute">{r.note}</span></span>
                <ExternalLink className="size-3.5 shrink-0 text-mute transition-colors group-hover:text-copper" />
              </a>
            ))}
          </div>
        </aside>
      </div>

      {/* ── Support (demo) ─────────────────────────────────── */}
      <section aria-label="Contact support (demo)" className="nx-panel relative overflow-hidden rounded-2xl">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 size-64 rounded-full bg-copper/10 blur-3xl" />
        <div className="relative grid gap-6 p-5 md:p-7 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-copper/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-copper"><span className="size-1.5 rounded-full bg-copper" />Demo only</span>
            <h2 className="mt-3 flex items-center gap-2 font-display text-[26px] font-semibold tracking-tight"><LifeBuoy className="size-6 text-copper" />Contact support</h2>
            <p className="mt-2 max-w-sm text-[12.5px] leading-6 text-mute">This panel previews how a support request could look. NEXORA has no ticketing system, inbox, or live chat — nothing you type here is sent or saved.</p>
          </div>
          <div className="min-w-0 space-y-3">
            <div>
              <p className="nx-eyebrow mb-1.5 text-[9.5px]">Topic</p>
              <div className="flex flex-wrap gap-1.5">
                {['Getting started', 'Wallet safety', 'Markets & data', 'Something else'].map((t) => <button key={t} type="button" onClick={() => { setTopic(t); setPreviewed(false) }} aria-pressed={topic === t} className={cn('rounded-full border px-3 py-1.5 text-[12px] transition-colors', topic === t ? 'border-copper/60 bg-copper/10 text-ink' : 'border-line text-mute hover:border-copper/30 hover:text-ink')}>{t}</button>)}
              </div>
            </div>
            <label className="block">
              <span className="nx-eyebrow mb-1.5 block text-[9.5px]">Your message</span>
              <textarea value={message} onChange={(e) => { setMessage(e.target.value); setPreviewed(false) }} rows={4} maxLength={500} placeholder="Describe what you need help with…" className="nx-field block w-full resize-none bg-transparent px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-mute/70" style={{ height: 'auto' }} />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setPreviewed(true)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-copper/50 bg-copper/10 px-4 text-[12.5px] transition-colors hover:bg-copper/20"><Send className="size-3.5" />Preview request</button>
              <span className="font-mono text-[11px] tabular-nums text-mute">{message.length}/500</span>
            </div>
            <div aria-live="polite">
              {previewed ? <p className="rounded-lg border border-dashed border-line/80 px-3.5 py-2.5 text-[12px] leading-5 text-mute"><Check className="mr-1.5 inline size-3.5 text-gain" />Demo preview for “{topic}”. Nothing was sent — there is no support backend in this prototype.</p> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
