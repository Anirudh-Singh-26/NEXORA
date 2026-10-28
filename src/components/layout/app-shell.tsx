import { useEffect, useState, type ReactNode } from 'react'
import { ArrowUp } from 'lucide-react'
import { Topbar } from '@/components/layout/topbar'
import { GlobalSearch } from '@/components/layout/global-search'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useUiStore } from '@/store/ui-store'

export function AppShell({ children }: { children: ReactNode }) {
  const theme = useUiStore((s) => s.theme)
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    const updateVisibility = () => setShowBackToTop(window.scrollY > 320)
    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  return <TooltipProvider>
    <div className="nx-app relative min-h-svh w-full min-w-0 max-w-full bg-canvas text-ink">
      <a href="#nx-main" className="sr-only z-50 rounded-md bg-raised px-3 py-2 text-sm text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
      <Topbar />
      <main id="nx-main" className="w-full min-w-0 max-w-full overflow-x-clip px-4 py-5 md:px-7 md:py-6">{children}</main>
      <GlobalSearch />
      <button
        type="button"
        aria-label="Scroll to top"
        title="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
        className={`fixed bottom-[72px] right-5 z-[200] grid size-14 place-items-center rounded-full border border-black/10 bg-[#e5e7eb] text-[#111827] shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-[opacity,transform,background-color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_28px_rgba(0,0,0,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a99aff] ${showBackToTop ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
      >
        <ArrowUp size={25} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  </TooltipProvider>
}
