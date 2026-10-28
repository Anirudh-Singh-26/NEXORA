import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Check, Coins, Gem, Layers, Rocket } from 'lucide-react'
import { Sparkline } from '@/components/shared/sparkline'
import { TokenGlyph } from '@/components/shared/token-glyph'
import { catalog } from '@/data/catalog'
import type { Collection, Token } from '@/data/types'
import { formatFloor, formatPercent, formatUsd } from '@/lib/format'
import { ease, popSpring, rise, stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { getCollectionById, getToken } from '@/data/selectors'
import { MediaImage } from '@/components/shared/media-image'
import { EmptyState } from '@/components/shared/empty-state'
import { useWatchlistStore } from '@/store/watchlist-store'
import { readStored, writeStored } from '@/features/workspaces/shared/browser-storage'

const PROFILE_KEY = 'nexora-profile-name'


const DEFAULT_NAME = 'Demo Explorer'


export function ProfileWorkspace() {
  const tokenIds = useWatchlistStore((s) => s.tokenIds)
  const collectionIds = useWatchlistStore((s) => s.collectionIds)
  const assetIds = useWatchlistStore((s) => s.assetIds)
  const campaignIds = useWatchlistStore((s) => s.campaignIds)
  const [storedName, setStoredName] = useState(() => readStored(PROFILE_KEY) ?? DEFAULT_NAME)
  const [draft, setDraft] = useState(storedName)
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle')

  useEffect(() => {
    if (status === 'idle') return
    const timer = window.setTimeout(() => setStatus('idle'), 2400)
    return () => window.clearTimeout(timer)
  }, [status])

  const displayName = draft.trim() || DEFAULT_NAME
  const dirty = (draft.trim() || DEFAULT_NAME) !== storedName
  const tokens = tokenIds.map(getToken).filter((t): t is Token => Boolean(t))
  const collections = collectionIds.map(getCollectionById).filter((c): c is Collection => Boolean(c))
  const assets = catalog.collections.flatMap((c) => c.nfts.map((n) => ({ n, c }))).filter(({ n }) => assetIds.includes(n.id))
  const total = tokens.length + collections.length + assets.length + campaignIds.length
  const avgChange = tokens.length ? tokens.reduce((s, t) => s + t.change24h, 0) / tokens.length : null

  const save = () => {
    const name = draft.trim() || DEFAULT_NAME
    const ok = writeStored(PROFILE_KEY, name)
    if (ok) { setStoredName(name); setDraft(name) }
    setStatus(ok ? 'saved' : 'failed')
  }

  const stats = [
    { label: 'Tokens', value: tokens.length, icon: <Coins size={15} /> },
    { label: 'Collections', value: collections.length, icon: <Layers size={15} /> },
    { label: 'Assets', value: assets.length, icon: <Gem size={15} /> },
    { label: 'Campaigns', value: campaignIds.length, icon: <Rocket size={15} /> },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* identity card */}
      <motion.aside initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="lg:sticky lg:top-[calc(var(--nx-topbar)+16px)] lg:self-start">
        <div className="nx-panel overflow-clip rounded-2xl">
          <div className="relative h-24 border-b border-line/70 bg-raised">
            <div aria-hidden className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_20%_120%,rgba(169,154,255,0.35),transparent_55%),radial-gradient(circle_at_85%_-20%,rgba(111,219,233,0.22),transparent_50%)]" />
          </div>
          <div className="px-5 pb-5">
            <motion.div key={displayName.charAt(0)} initial={{ scale: 0.85, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={popSpring} className="relative z-10 -mt-9 flex size-[72px] items-center justify-center rounded-2xl border-2 border-canvas bg-gradient-to-br from-copper/30 to-sage/15 font-display text-[30px] text-ink shadow-[0_12px_30px_-12px_rgba(92,68,224,0.7)]" aria-hidden>
              {displayName.charAt(0).toUpperCase()}
            </motion.div>
            <h2 className="mt-3 truncate font-display text-[24px] font-semibold tracking-tight">{displayName}</h2>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] text-mute"><span className="size-1.5 rounded-full bg-copper" /> Local demo profile · this browser only</p>

            <form className="mt-5 border-t border-line/70 pt-4" onSubmit={(e) => { e.preventDefault(); save() }}>
              <label className="block">
                <span className="nx-eyebrow text-[9.5px]">Display name</span>
                <input value={draft} maxLength={40} onChange={(e) => { setDraft(e.target.value); setStatus('idle') }} className="nx-field mt-2 h-10 w-full px-3 text-[13.5px] text-ink outline-none" placeholder={DEFAULT_NAME} aria-label="Display name" autoComplete="off" />
              </label>
              <div className="mt-1.5 flex justify-between text-[10.5px] text-mute/70"><span>Shown only in this browser</span><span className="font-mono tabular-nums">{draft.length}/40</span></div>
              <div className="mt-4 flex items-center gap-3">
                <button type="submit" disabled={!dirty} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">Save local profile</button>
                <p role="status" className={cn('inline-flex items-center gap-1.5 text-[12px]', status === 'failed' ? 'text-loss' : 'text-copper')}>
                  {status === 'saved' ? <><Check size={13} /> Saved in this browser.</> : status === 'failed' ? 'Browser storage is unavailable.' : dirty ? <span className="text-mute">Unsaved changes</span> : null}
                </p>
              </div>
            </form>
          </div>
        </div>
        <p className="mt-3 px-1 text-[11px] leading-5 text-mute">This profile is local demo state, not a secure account. Do not enter sensitive personal information.</p>
      </motion.aside>

      {/* overview */}
      <div className="min-w-0 space-y-6">
        <motion.div initial="hidden" animate="show" variants={stagger(0.05)} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <motion.div key={s.label} variants={rise} className="nx-surface rounded-xl px-4 py-3.5">
              <div className="flex items-center justify-between text-mute"><span className="nx-eyebrow text-[9.5px]">{s.label}</span><span className="text-copper">{s.icon}</span></div>
              <p className="mt-3 font-mono text-[26px] leading-none tabular-nums">{String(s.value).padStart(2, '0')}</p>
            </motion.div>
          ))}
        </motion.div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="nx-kicker">Saved context</p>
            <h2 className="mt-1.5 text-[19px] font-semibold tracking-tight">What you’re following</h2>
          </div>
          <Link to="/watchlist" className="group inline-flex items-center gap-1 text-[12px] text-mute transition-colors hover:text-ink">Open watchlist <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></Link>
        </div>

        {total === 0 ? (
          <EmptyState title="Nothing saved yet" body="Bookmark tokens, collections, assets or drops and they’ll be summarised here." action={<Link to="/discover" className="text-sm text-copper hover:underline">Start exploring</Link>} />
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="nx-surface rounded-xl p-4" aria-label="Saved tokens">
              <div className="flex items-baseline justify-between"><h3 className="nx-eyebrow text-[9.5px]">Tokens</h3>{avgChange !== null ? <span className={cn('font-mono text-[11px] tabular-nums', avgChange >= 0 ? 'text-gain' : 'text-loss')}>avg {formatPercent(avgChange)}</span> : null}</div>
              {tokens.length === 0 ? <p className="mt-3 text-[12.5px] text-mute">No tokens saved.</p> : (
                <ul className="mt-2 -mx-1.5">
                  {tokens.map((t) => (
                    <li key={t.id}><Link to={`/tokens/${t.id}`} className="group flex items-center gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-inset/60">
                      <TokenGlyph token={t} className="size-7" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium group-hover:text-copper">{t.name}</span><span className="block font-mono text-[10.5px] tabular-nums text-mute">{formatUsd(t.price)}</span></span>
                      <Sparkline data={t.sparkline} positive={t.change24h >= 0} className="h-6 w-14" />
                      <span className={cn('w-14 text-right font-mono text-[11px] tabular-nums', t.change24h >= 0 ? 'text-gain' : 'text-loss')}>{formatPercent(t.change24h)}</span>
                    </Link></li>
                  ))}
                </ul>
              )}
            </section>

            <section className="nx-surface rounded-xl p-4" aria-label="Saved collections">
              <h3 className="nx-eyebrow text-[9.5px]">Collections</h3>
              {collections.length === 0 ? <p className="mt-3 text-[12.5px] text-mute">No collections saved.</p> : (
                <ul className="mt-2 -mx-1.5">
                  {collections.map((c) => (
                    <li key={c.id}><Link to={`/collections/${c.slug}`} className="group flex items-center gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-inset/60">
                      <MediaImage src={c.cover} alt="" className="size-10 shrink-0 rounded-lg" fallbackLabel={c.name.slice(0, 2)} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium group-hover:text-copper">{c.name}</span><span className="block text-[10.5px] text-mute">by {c.creator}</span></span>
                      <span className="text-right"><span className="nx-eyebrow block text-[8.5px]">Floor</span><span className="font-mono text-[11.5px] tabular-nums">{formatFloor(c.floor, c.floorSymbol)}</span></span>
                    </Link></li>
                  ))}
                </ul>
              )}
            </section>

            {assets.length > 0 ? (
              <section className="nx-surface rounded-xl p-4 xl:col-span-2" aria-label="Saved assets">
                <h3 className="nx-eyebrow text-[9.5px]">Digital assets</h3>
                <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {assets.map(({ n, c }) => (
                    <li key={n.id}><Link to={`/assets/${n.id}`} className="group block" title={`${n.name} · ${c.name}`}>
                      <MediaImage src={n.image} alt={n.name} className="aspect-square w-full rounded-lg transition-transform duration-300 group-hover:-translate-y-0.5" fallbackLabel={n.tokenId} />
                      <span className="mt-1.5 block truncate text-[11px] text-mute group-hover:text-ink">{n.name}</span>
                    </Link></li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Settings: sectioned preferences ───────────────────────────────────── */
