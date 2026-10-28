import { lazy, Suspense, useLayoutEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useMotionReduced } from '@/lib/motion'
import { AppShell } from '@/components/layout/app-shell'
import { WalletProvider } from '@/features/wallet-provider'
import { TronProvider } from '@/features/tron/tron-provider'
import { ActiveWalletCoordinator } from '@/features/wallet/active-wallet-coordinator'

const DiscoverPage = lazy(() => import('@/features/discover/discover-page').then((m) => ({ default: m.DiscoverPage })))
const CollectionsPage = lazy(() => import('@/features/collections/collections-page').then((m) => ({ default: m.CollectionsPage })))
const CollectionDetailPage = lazy(() => import('@/features/collections/collection-detail-page').then((m) => ({ default: m.CollectionDetailPage })))
const TokensPage = lazy(() => import('@/features/tokens/tokens-page').then((m) => ({ default: m.TokensPage })))
const TokenDetailPage = lazy(() => import('@/features/tokens/token-detail-page').then((m) => ({ default: m.TokenDetailPage })))
const WatchlistPage = lazy(() => import('@/features/watchlist/watchlist-page').then((m) => ({ default: m.WatchlistPage })))
const WalletPage = lazy(() => import('@/features/wallet/wallet-page').then((m) => ({ default: m.WalletPage })))
const Web3FoundationPage = lazy(() => import('@/features/web3/web3-foundation-page').then((m) => ({ default: m.Web3FoundationPage })))
const NotFoundPage = lazy(() => import('@/features/not-found').then((m) => ({ default: m.NotFoundPage })))
const AssetDetailPage = lazy(() => import('@/features/workspaces').then((m) => ({ default: m.AssetDetailPage })))
const WorkspacePage = lazy(() => import('@/features/workspaces').then((m) => ({ default: m.WorkspacePage })))

function AnimatedRouteTable() {
  const location = useLocation()

  // Every page starts at the top when navigation changes, instead of inheriting
  // the previous route's scroll position. useLayoutEffect avoids a visible jump.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -2, transition: { duration: 0.1, ease: 'easeIn' } }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="min-w-0"
      >
        <Suspense fallback={<div className="min-h-[40vh]" role="status" aria-label="Loading page" />}>
        <Routes location={location}>
          <Route path="/" element={<Navigate to="/discover" replace />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/:slug" element={<CollectionDetailPage />} />
          <Route path="/tokens" element={<TokensPage />} />
          <Route path="/tokens/:id" element={<TokenDetailPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/web3" element={<Web3FoundationPage />} />
          <Route path="/assets/:assetId" element={<AssetDetailPage />} />
          <Route path="/ecosystems" element={<WorkspacePage page="ecosystems" />} />
          <Route path="/drops" element={<WorkspacePage page="drops" />} />
          <Route path="/activity" element={<WorkspacePage page="activity" />} />
          <Route path="/tools" element={<WorkspacePage page="tools" />} />
          <Route path="/assistant" element={<WorkspacePage page="assistant" />} />
          <Route path="/swap" element={<WorkspacePage page="swap" />} />
          <Route path="/rewards" element={<WorkspacePage page="rewards" />} />
          <Route path="/profile" element={<WorkspacePage page="profile" />} />
          <Route path="/settings" element={<WorkspacePage page="settings" />} />
          <Route path="/notifications" element={<WorkspacePage page="notifications" />} />
          <Route path="/help" element={<WorkspacePage page="help" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  const reduced = useMotionReduced()
  return (
    <BrowserRouter>
      <WalletProvider>
        <TronProvider>
          <ActiveWalletCoordinator />
          <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
            <AppShell>
              <AnimatedRouteTable />
            </AppShell>
          </MotionConfig>
        </TronProvider>
      </WalletProvider>
    </BrowserRouter>
  )
}
