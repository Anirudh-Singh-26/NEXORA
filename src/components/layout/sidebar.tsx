import {
  Activity,
  Bell,
  Bookmark,
  Bot,
  CalendarDays,
  CircleHelp,
  Coins,
  Compass,
  Gift,
  Layers3,
  Network,
  Settings2,
  UserRound,
  Wallet,
  Wrench,
} from 'lucide-react'
import { motion } from 'motion/react'
import { NavLink } from 'react-router-dom'
import { useWatchlistStore } from '@/store/watchlist-store'
import { cn } from '@/lib/utils'
import { sidebarNavigation } from '@/data/catalog'

const groups = sidebarNavigation
const navIcons = {
  compass: Compass,
  layers: Layers3,
  coins: Coins,
  network: Network,
  calendar: CalendarDays,
  bookmark: Bookmark,
  activity: Activity,
  wrench: Wrench,
  bot: Bot,
  wallet: Wallet,
  gift: Gift,
  user: UserRound,
  settings: Settings2,
  bell: Bell,
  help: CircleHelp,
}

/** Small orbital glyph: nucleus + tilted ring + node. */
function BrandGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
      <defs>
        <linearGradient id="nx-glyph" x1="3" y1="3" x2="21" y2="21">
          <stop stopColor="#b9a8ff" />
          <stop offset="1" stopColor="#6fdbe9" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="4.2" fill="url(#nx-glyph)" opacity="0.95" />
      <ellipse cx="12" cy="12" rx="9.4" ry="3.6" transform="rotate(-24 12 12)" stroke="url(#nx-glyph)" strokeWidth="1.1" opacity="0.8" />
      <circle cx="19.4" cy="8.2" r="1.35" fill="#eef1fc" />
    </svg>
  )
}

export function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const watching =
    useWatchlistStore((s) => s.tokenIds.length) +
    useWatchlistStore((s) => s.collectionIds.length) +
    useWatchlistStore((s) => s.assetIds.length) +
    useWatchlistStore((s) => s.campaignIds.length)

  return (
    <div
      className={cn(
        'flex h-full w-[260px] min-w-[260px] flex-col overflow-hidden transition-colors duration-[220ms] ease-linear',
        collapsed ? 'bg-canvas' : 'bg-raised/95',
      )}
    >
      {/* Fixed header height keeps every navigation item anchored during expand/collapse. */}
      <div className="relative flex h-[76px] shrink-0 items-center px-0">
        <NavLink
          to="/discover"
          onClick={onNavigate}
          aria-label="NEXORA Observatory — Overview"
          className="absolute inset-0 rounded-none outline-offset-[-3px] focus-visible:outline focus-visible:outline-1 focus-visible:outline-copper/70"
        >
          <span
            className="nx-brand-mark absolute left-3.5 top-4 flex size-11 shrink-0 items-center justify-center rounded-2xl border border-copper/30"
          >
            <BrandGlyph />
          </span>
          <motion.span
            aria-hidden={collapsed}
            animate={{ opacity: collapsed ? 0 : 1 }}
            transition={{ duration: 0.16, ease: 'linear' }}
            className="pointer-events-none absolute left-[76px] top-1/2 min-w-0 -translate-y-1/2 whitespace-nowrap"
          >
            <span className="block text-[15px] font-semibold leading-none tracking-[0.1em]">NEXORA</span>
            <span className="mt-1 block text-[9.5px] uppercase leading-none tracking-[0.26em] text-mute">Observatory</span>
          </motion.span>
        </NavLink>
      </div>

      <nav
        className="nx-nav-scroll flex flex-1 flex-col gap-2 overflow-x-hidden overflow-y-hidden px-2.5 py-2"
        aria-label="Primary"
      >
        {groups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {/* Keep the heading slot mounted at a fixed height in both states. This prevents
                every group below it from jumping when the sidebar expands or collapses. */}
            <motion.p
              aria-hidden={collapsed}
              animate={{ opacity: collapsed ? 0 : 1 }}
              transition={{ duration: 0.16, ease: 'linear' }}
              className="h-[22px] overflow-hidden whitespace-nowrap px-3 pb-1 pt-1.5 text-[9.5px] font-medium uppercase leading-[14px] tracking-[0.22em] text-mute/60"
              style={{ pointerEvents: 'none' }}
            >
              {group.label}
            </motion.p>
            {group.links.map((link) => {
              const Icon = navIcons[link.iconKey]
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/discover'}
                  onClick={onNavigate}
                  title={collapsed ? link.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'nx-nav-item group relative flex h-7 w-full shrink-0 items-center rounded-xl text-[13px] outline-offset-[-2px] transition-[color,background-color,border-color,border-radius] duration-[220ms] ease-linear',
                      'justify-start px-0',
                      isActive ? 'text-ink' : 'text-mute hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <motion.span
                          initial={false}
                          animate={{ width: collapsed ? 44 : '100%' }}
                          transition={{ duration: 0.22, ease: 'linear' }}
                          className="absolute bottom-0 left-0 top-0 rounded-xl bg-gradient-to-r from-copper/[0.14] to-copper/[0.03]"
                        />
                      ) : (
                        <span
                          className={cn(
                            'absolute bottom-0 left-0 top-0 rounded-xl bg-inset opacity-0 transition-[width,opacity] duration-[220ms] ease-linear group-hover:opacity-100',
                            collapsed ? 'w-[44px]' : 'w-full',
                          )}
                        />
                      )}
                      <Icon
                        className={cn('absolute left-[14px] z-[1] size-[15px] shrink-0 transition-colors', isActive && 'text-copper')}
                        strokeWidth={1.8}
                      />
                      <motion.span
                        aria-hidden={collapsed}
                        animate={{ opacity: collapsed ? 0 : 1 }}
                        transition={{ duration: 0.16, ease: 'linear' }}
                        className="pointer-events-none absolute left-[38px] right-3 min-w-0 truncate whitespace-nowrap text-left"
                      >
                        {link.label}
                      </motion.span>
                      {link.to === '/watchlist' && watching > 0 ? (
                        <motion.span
                          aria-hidden={collapsed}
                          animate={{ opacity: collapsed ? 0 : 1 }}
                          transition={{ duration: 0.16, ease: 'linear' }}
                          className="pointer-events-none absolute left-[258px] rounded-full border border-copper/25 bg-copper/10 px-1.5 text-[10.5px] leading-[18px] text-copper"
                        >
                          {watching}
                        </motion.span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>
    </div>
  )
}
