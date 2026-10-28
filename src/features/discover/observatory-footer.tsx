import { useRef } from 'react'
import { AudioLines, Globe2, Orbit } from 'lucide-react'
import { Link } from 'react-router-dom'
import { catalog } from '@/data/catalog'
import { formatUsd } from '@/lib/format'
import { useUiStore } from '@/store/ui-store'

const footerLinks = [
  { label: 'Collections', to: '/collections' },
  { label: 'Tokens', to: '/tokens' },
  { label: 'Activity', to: '/activity' },
  { label: 'Help center', to: '/help' },
  { label: 'Settings', to: '/settings' },
]

const brandLetters = ['N', 'E', 'X', 'O', 'R', 'A']
const CURRENT_YEAR = new Date().getFullYear()

/** Integrated Discover end-cap with an oversized wordmark and compact utility footer. */
export function ObservatoryFooter() {
  const footerRef = useRef<HTMLElement>(null)
  const theme = useUiStore((s) => s.theme)
  const eth = catalog.tokens.find((token) => token.ticker === 'ETH') ?? catalog.tokens[0]
  const sol = catalog.tokens.find((token) => token.ticker === 'SOL') ?? catalog.tokens[1]
  const light = theme === 'light'

  const scrollDiscoverToTop = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    let node: HTMLElement | null = footerRef.current?.parentElement ?? null

    // Scroll the app's actual scroll container when one exists; otherwise scroll the document.
    while (node && node !== document.body && node !== document.documentElement) {
      const style = window.getComputedStyle(node)
      const canScroll = /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight
      if (canScroll) {
        node.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      node = node.parentElement
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer ref={footerRef} className="nx-observatory-footer relative -mb-5 mt-8 w-full min-w-0 max-w-full overflow-x-clip overflow-y-hidden pt-2 sm:mt-10 sm:pt-3 md:-mb-6" aria-label="NEXORA footer">
      <div className="relative px-1 py-2 sm:px-2 sm:py-3" aria-label="NEXORA wordmark">
        <svg
          className="font-display block h-[clamp(5.2rem,14vw,14rem)] w-full min-w-0 max-w-full select-none overflow-hidden text-ink"
          viewBox="0 0 1120 190"
          preserveAspectRatio="none"
          role="img"
          aria-label="NEXORA"
          style={{ textRendering: 'geometricPrecision' }}
        >
          <style>{`
            .nx-wordmark-letter { transition: none !important; cursor: default; }
            .nx-wordmark-letter:nth-of-type(odd):hover { fill: #a99aff !important; }
            .nx-wordmark-letter:nth-of-type(even):hover { fill: #6fdbe9 !important; }
          `}</style>
          {brandLetters.map((letter, index) => (
            <text
              key={letter}
              className="nx-wordmark-letter"
              x={[80, 270, 460, 650, 840, 1030][index]}
              y="158"
              textAnchor="middle"
              fontSize="172"
              fontWeight="900"
              letterSpacing="-7"
              fill="currentColor"
              pointerEvents="visiblePainted"
              style={{ transition: 'none' }}
            >
              {letter}
            </text>
          ))}
        </svg>
        <div className="mt-4 flex items-center justify-between gap-4 px-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-mute/80 sm:text-[10px]">
          <span>Multi-chain observatory</span>
          <span className="inline-flex items-center gap-1.5"><Orbit className="size-3.5 text-copper" /> Culture, priced in public.</span>
        </div>
      </div>

      <div className="relative mt-6 flex flex-col gap-4 border-y border-line/55 px-1 py-4 sm:mt-7 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Footer navigation">
          <Link to="/discover" onClick={scrollDiscoverToTop} className="mr-1 inline-flex items-center gap-2 text-[12px] font-semibold tracking-wide text-ink transition-colors hover:text-copper" aria-label="Scroll to top of Discover page">
            <Orbit className="size-4 text-copper" /> NEXORA
          </Link>
          {footerLinks.map((item) => (
            <Link key={item.to} to={item.to} className="text-[11px] text-mute transition-colors hover:text-ink">{item.label}</Link>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-[11px]">
          <span className="rounded-full bg-inset px-3 py-2 font-semibold text-ink">USD</span>
          <span className="text-mute">Demo market</span>
          <Link to={`/tokens/${eth?.id ?? ''}`} className="inline-flex items-center gap-1.5 font-medium text-ink transition-colors hover:text-copper">
            <span className="grid size-4 place-items-center rounded-full bg-copper/15 text-[9px] font-bold text-copper">{eth?.ticker?.slice(0, 1) ?? 'E'}</span>
            {formatUsd(eth?.price ?? 0)}
          </Link>
          <Link to={`/tokens/${sol?.id ?? ''}`} className="inline-flex items-center gap-1.5 font-medium text-ink transition-colors hover:text-copper">
            <span className="grid size-4 place-items-center rounded-full bg-sage/15 text-[9px] font-bold text-sage">{sol?.ticker?.slice(0, 1) ?? 'S'}</span>
            {formatUsd(sol?.price ?? 0)}
          </Link>
          <Link to="/activity" className="inline-flex items-center gap-1.5 text-mute transition-colors hover:text-ink"><AudioLines className="size-3.5" /> Activity</Link>
          <Link to="/ecosystems" className="inline-flex items-center gap-1.5 text-mute transition-colors hover:text-ink"><Globe2 className="size-3.5" /> Networks</Link>
        </div>
      </div>

      <div className={`relative mt-4 border-t py-4 ${light ? 'border-slate-300/55' : 'border-white/[0.045]'}`}>
        <div className="flex flex-col gap-2 text-[10px] leading-[1.75] text-mute/80 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <p className="max-w-5xl">
            NEXORA is a discovery interface prototype. Collection floors, token prices, market capitalization, volume, sales, holders, and other market figures shown here are illustrative demo data and may not reflect live markets. No wallet connection, transaction execution, or live blockchain indexing is provided by this demo.
          </p>
          <span className="shrink-0 font-mono text-[9px] tracking-wide text-mute/70">© {CURRENT_YEAR} NEXORA · BUILT FOR DISCOVERY</span>
        </div>
      </div>
    </footer>
  )
}
