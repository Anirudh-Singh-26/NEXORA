import { ArrowUpRight, Activity, Bell, Bookmark, CalendarDays, ChevronDown, CircleHelp, Coins, Compass, Gift, Layers3, LoaderCircle, LogIn, Menu, Moon, Network, Search, Settings2, Sun, UserRound, Wallet, Wrench, Bot, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useUiStore } from '@/store/ui-store'
import { useWallet } from '@/features/wallet-provider'

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
const iconMap = {
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

type MenuIcon = keyof typeof iconMap

type MenuLink = {
  label: string
  to: string
  icon: MenuIcon
}

type MenuColumn = {
  heading: string
  links: MenuLink[]
}

type MenuGroup = {
  label: string
  columns: MenuColumn[]
}
const menuGroups: MenuGroup[] = [
  {
    label: 'Explore', columns: [
      { heading: 'Discover', links: [{ label: 'Overview', to: '/discover', icon: 'compass' }, { label: 'Collections', to: '/collections', icon: 'layers' }, { label: 'Tokens', to: '/tokens', icon: 'coins' }, { label: 'Ecosystems', to: '/ecosystems', icon: 'network' }, { label: 'Web3 Data Lab', to: '/web3', icon: 'network' }, { label: 'Wallet', to: '/wallet', icon: 'wallet' }] },
    ]
  },
  {
    label: 'Activity', columns: [
      { heading: 'Market activity', links: [{ label: 'Drops & Airdrops', to: '/drops', icon: 'calendar' }, { label: 'Activity', to: '/activity', icon: 'activity' }, { label: 'Watchlist', to: '/watchlist', icon: 'bookmark' }] },
    ]
  },
  {
    label: 'Tools', columns: [
      { heading: 'Research', links: [{ label: 'Web3 Tools', to: '/tools', icon: 'wrench' }, { label: 'AI Assistant', to: '/assistant', icon: 'bot' }, { label: 'Help & Resources', to: '/help', icon: 'help' }] },
    ]
  },
  {
    label: 'Demo', columns: [
      { heading: 'Try NEXORA', links: [{ label: 'Swap · Demo', to: '/swap', icon: 'wallet' }, { label: 'Rewards · Demo', to: '/rewards', icon: 'gift' }] },
    ]
  },
  {
    label: 'Account', columns: [
      { heading: 'Your account', links: [{ label: 'Profile', to: '/profile', icon: 'user' }, { label: 'Settings', to: '/settings', icon: 'settings' }, { label: 'Notifications', to: '/notifications', icon: 'bell' }] },
    ]
  },
] as const

function BrandGlyph() {
  return <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden><defs><linearGradient id="nx-nav-glyph" x1="3" y1="3" x2="21" y2="21"><stop stopColor="#b9a8ff" /><stop offset="1" stopColor="#6fdbe9" /></linearGradient></defs><circle cx="12" cy="12" r="4.2" fill="url(#nx-nav-glyph)" /><ellipse cx="12" cy="12" rx="9.4" ry="3.6" transform="rotate(-24 12 12)" stroke="url(#nx-nav-glyph)" strokeWidth="1.1" /><circle cx="19.4" cy="8.2" r="1.35" fill="#eef1fc" /></svg>
}

export function Topbar() {
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const wallet = useWallet()
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ left: 0, arrowLeft: 28 })
  const navRef = useRef<HTMLElement>(null)
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const closeTimer = useRef<number | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const shouldScrollToDiscover = useRef(false)

  const goToDiscoveryTop = () => {
    setActiveMenu(null)
    setMobileOpen(false)
    if (location.pathname === '/discover') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    shouldScrollToDiscover.current = true
    navigate('/discover')
  }

  const positionMenu = (label: string) => {
    const nav = navRef.current
    const trigger = triggerRefs.current[label]
    if (!nav || !trigger) return

    const navRect = nav.getBoundingClientRect()
    const triggerRect = trigger.getBoundingClientRect()
    const panelWidth = Math.min(316, window.innerWidth - 24)
    const desiredLeft = triggerRect.left - navRect.left
    const maxLeft = Math.max(0, window.innerWidth - panelWidth - navRect.left - 12)
    const left = Math.max(0, Math.min(desiredLeft, maxLeft))
    const arrowLeft = Math.max(20, Math.min(panelWidth - 20, desiredLeft - left + triggerRect.width / 2 - 5))
    setMenuPosition({ left, arrowLeft })
  }

  const openMenu = (label: string) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
    positionMenu(label)
    setActiveMenu(label)
  }
  const scheduleMenuClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setActiveMenu(null)
      if (window.scrollY > 80) setIsExpanded(false)
    }, 190)
  }

  useEffect(() => {
    const updateScrollState = () => {
      const scrolled = window.scrollY > 80
      setIsScrolled(scrolled)
      if (!scrolled) setIsExpanded(false)
    }
    updateScrollState()
    window.addEventListener('scroll', updateScrollState, { passive: true })
    return () => window.removeEventListener('scroll', updateScrollState)
  }, [])

  useEffect(() => {
    // Defer state updates to avoid synchronous setState in effect
    setTimeout(() => {
      setActiveMenu(null)
      setMobileOpen(false)
    }, 0)
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    if (location.pathname === '/discover' && shouldScrollToDiscover.current) {
      shouldScrollToDiscover.current = false
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
    }
  }, [location.pathname])
  useEffect(() => {
    if (!activeMenu) return
    const reposition = () => positionMenu(activeMenu)
    window.addEventListener('resize', reposition)
    return () => window.removeEventListener('resize', reposition)
  }, [activeMenu])
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current) }, [])
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setActiveMenu(null); setMobileOpen(false) } }
    const outside = (event: MouseEvent) => { if (navRef.current && !navRef.current.contains(event.target as Node)) setActiveMenu(null) }
    window.addEventListener('keydown', close); document.addEventListener('mousedown', outside)
    return () => { window.removeEventListener('keydown', close); document.removeEventListener('mousedown', outside) }
  }, [])

  const compact = isScrolled && !isExpanded

  return <header className={`nx-topbar sticky top-0 z-50 w-full ${isScrolled ? 'is-scrolled' : ''} ${compact ? 'is-compact' : ''} ${isExpanded ? 'is-expanded' : ''}`} onPointerEnter={() => { if (closeTimer.current) window.clearTimeout(closeTimer.current); closeTimer.current = null; if (isScrolled) setIsExpanded(true) }} onPointerLeave={scheduleMenuClose}>
    <div className="nx-topbar__bar" onPointerEnter={() => { if (closeTimer.current) window.clearTimeout(closeTimer.current); closeTimer.current = null; if (isScrolled) setIsExpanded(true) }} onFocusCapture={() => { if (isScrolled) setIsExpanded(true) }}>
      <Link to="/discover" className="nx-topbar__brand" aria-label="NEXORA Observatory home" onClick={(event) => { event.preventDefault(); goToDiscoveryTop() }} onPointerEnter={() => { if (isScrolled) setIsExpanded(true) }}><span className="nx-topbar__brand-mark"><BrandGlyph /></span><span className="nx-topbar__brand-copy"><strong>NEXORA</strong><small>OBSERVATORY</small></span></Link>
      <nav ref={navRef} className="nx-topbar__nav" aria-label="Main navigation">
        {menuGroups.map((menu) => <button key={menu.label} ref={(element) => { triggerRefs.current[menu.label] = element }} type="button" className={`nx-topbar__nav-trigger ${activeMenu === menu.label ? 'is-open' : ''}`} aria-expanded={activeMenu === menu.label} onMouseEnter={() => openMenu(menu.label)} onFocus={() => openMenu(menu.label)} onClick={() => activeMenu === menu.label ? setActiveMenu(null) : openMenu(menu.label)}>{menu.label}<ChevronDown className="nx-topbar__chevron" size={13} /></button>)}
        {activeMenu && <div key={activeMenu} className="nx-mega-menu" style={{ left: `${menuPosition.left}px`, '--nx-mega-arrow-left': `${menuPosition.arrowLeft}px` } as CSSProperties} role="region" aria-label={`${activeMenu} navigation`} onPointerEnter={() => { if (closeTimer.current) window.clearTimeout(closeTimer.current); closeTimer.current = null; if (isScrolled) setIsExpanded(true) }}>
          {menuGroups.find((menu) => menu.label === activeMenu)?.columns.map((column) => <section className="nx-mega-menu__column" key={column.heading}><h3>{column.heading}</h3>{column.links.map((link) => { const Icon = iconMap[link.icon] ?? CircleHelp; return <NavLink key={link.to + link.label} to={link.to} className={({ isActive }) => `nx-mega-menu__link ${isActive ? 'is-current' : ''}`} onClick={() => setActiveMenu(null)}><span className="nx-mega-menu__icon"><Icon size={18} strokeWidth={1.9} /></span><span className="nx-mega-menu__copy"><strong>{link.label}</strong></span><ArrowUpRight className="nx-mega-menu__arrow" size={15} /></NavLink> })}</section>)}
        </div>}
      </nav>
      <div className="nx-topbar__actions">
        <button type="button" onClick={() => setSearchOpen(true)} className="nx-search-trigger nx-topbar__search" aria-label="Search collections and tokens"><Search size={16} /><span>Search</span><kbd>{isMac ? '⌘ K' : 'Ctrl K'}</kbd></button>
        <button type="button" onClick={toggleTheme} className="nx-theme-toggle nx-topbar__theme" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
        <button type="button" className={`nx-login-button ${wallet.address ? 'is-connected' : ''}`} onClick={() => void wallet.connect()} aria-haspopup="dialog" aria-busy={wallet.isConnecting} title={wallet.address ? `Connected: ${wallet.address}` : 'Log in by connecting a wallet'}>{wallet.isConnecting ? <LoaderCircle size={15} className="animate-spin" /> : wallet.address ? <span className="nx-wallet-status-dot" aria-hidden="true" /> : <LogIn size={15} />}<span>{wallet.address ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : wallet.isConnecting ? 'CONNECTING' : 'LOG IN'}</span><ArrowUpRight size={15} /></button>
        <button type="button" className="nx-mobile-menu-button" onClick={() => setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}>{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>
      </div>
    </div>
    {mobileOpen && <div className="nx-mobile-menu">{menuGroups.map((menu) => <section key={menu.label}><h3>{menu.label}</h3><div>{menu.columns.flatMap((column) => column.links).filter((link, index, arr) => arr.findIndex((candidate) => candidate.to === link.to) === index).map((link) => { const Icon = iconMap[link.icon] ?? CircleHelp; return <Link key={link.to} to={link.to}><Icon size={16} />{link.label}<ArrowUpRight size={13} /></Link> })}</div></section>)}</div>}
  </header>
}
