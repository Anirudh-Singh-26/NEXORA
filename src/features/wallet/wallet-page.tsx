import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, ShieldCheck } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { TonWalletSlot } from '@/features/ton/ton-wallet-slot'
import { TronWalletPanel } from '@/features/tron/tron-wallet-panel'
import { WalletActivityPanel } from '@/features/wallet/wallet-activity-panel'
import { useCopyAddress } from '@/features/wallet/wallet-copy'
import { WalletWorkspace, WalletsHeader, type EcosystemId } from '@/features/wallet/wallet-dashboard'
import { EvmWalletDetails } from '@/features/wallet/wallet-evm-details'
import { WalletNftsView } from '@/features/wallet/wallet-nfts-card'
import { WalletTokensView } from '@/features/wallet/wallet-tokens-card'
import { useConnectionCounts, useTonSummaryStore } from '@/features/wallet/wallet-connections'
import { UnifiedConnectionModal } from '@/features/wallet/unified-connection-modal'
import { useWalletPortfolio, SOURCE_LABEL, type CountView, type SourceStatus } from '@/features/wallet/use-wallet-portfolio'
import { useWalletActivity } from '@/hooks/use-wallet-activity'
import { blockchain } from '@/lib/blockchain'
import { motionReduced } from '@/lib/motion'
import { networkStatusLabel } from '@/lib/network/environments'
import { BRAND_HUES, identityHues } from '@/lib/wallet/orb-model'
import '@/styles/wallet-dashboard.css'

/** A count only when the number is real (a completed read without error). */
function countText(view: CountView, unsupported: boolean): string {
  if (unsupported) return 'N/A'
  return view.count === null ? '—' : `${view.count}${view.more ? '+' : ''}`
}

/** Shown in place of a data section while the connected wallet is not verifiably on the supported test network. */
function WrongNetworkNotice({ label, message }: { label: string; message: string | null }) {
  return (
    <section className="wlt-section" aria-label={label}>
      <div className="wlt-state is-info" role="status">
        <span className="wlt-state__icon" aria-hidden="true"><CircleAlert size={18} /></span>
        <div className="wlt-state__body">
          <strong>{label} unavailable: wallet is not on the supported test network</strong>
          <p>{message ?? 'NEXORA could not verify your wallet network.'} Nothing was requested for this account.</p>
        </div>
      </div>
    </section>
  )
}

export function WalletPage() {
  const portfolio = useWalletPortfolio()
  const { wallet, tokens, nfts } = portfolio
  const copy = useCopyAddress()
  const [params] = useSearchParams()
  // Presentation only: which ecosystem the stage shows. Every panel stays mounted; the others are hidden.
  const [selected, setSelected] = useState<EcosystemId>('ethereum')
  // The stage's identity comes only from its own account (EVM address / Solana public key), never from AppKit's active one.
  const stageEcosystem: 'evm' | 'solana' = selected === 'solana' ? 'solana' : 'evm'
  const stageIsSolana = stageEcosystem === 'solana'
  const stageAddress = stageIsSolana ? wallet.solanaAddress : wallet.evmAddress
  // Testnet-only: the stage reads data only while its wallet ACTUALLY reports the supported test network (Sepolia / Devnet).
  // Otherwise nothing is requested and the wrong or unverified network is explained instead of guessed or relabelled.
  const stageVerification = stageIsSolana ? portfolio.solVerification : portfolio.evmVerification
  const stageReady = stageVerification.status === 'verified'
  const activity = useWalletActivity({ ecosystem: stageEcosystem, address: stageReady ? stageAddress : null, chainId: wallet.chainId, solanaNetworkName: wallet.solanaNetworkName })
  const connected = stageAddress !== null
  const solanaOnly = stageIsSolana
  const evmChain = tokens.target.kind === 'ready' ? blockchain.resolveChain(tokens.target.chainId) : null  // TON section reports its connection summary upward so the page header can count it.
  const tonSummary = useTonSummaryStore((state) => state.summary)
  const reportTon = useTonSummaryStore((state) => state.report)
  const counts = useConnectionCounts(tonSummary)
  const [connectModalOpen, setConnectModalOpen] = useState(false)

  const jump = useCallback((id: string) => {
    // Panels that are not selected are hidden, so bring the owning ecosystem forward before scrolling to it.
    if (id === 'wlt-ton') setSelected('ton')
    else if (id === 'wlt-tron') setSelected('tron')
    else setSelected((prev) => (prev === 'ethereum' || prev === 'solana' ? prev : !wallet.evmAddress && wallet.solanaAddress ? 'solana' : 'ethereum'))
    window.requestAnimationFrame(() => {
      const element = document.getElementById(id)
      if (!element) return
      element.scrollIntoView({ behavior: motionReduced() ? 'auto' : 'smooth', block: 'start' })
      element.focus({ preventScroll: true })
    })
  }, [wallet.evmAddress, wallet.solanaAddress])

  // Older links used ?tab=nfts (holdings were tabbed). Both lists are on the page now, so the link scrolls to the right one.
  const deepLinked = useRef(false)
  useEffect(() => {
    if (!connected || deepLinked.current) return
    const tab = params.get('tab')
    if (tab === 'nfts' || tab === 'activity') {
      deepLinked.current = true
      window.requestAnimationFrame(() => jump(tab === 'nfts' ? 'wlt-nfts' : 'wlt-activity'))
    }
  }, [connected, params, jump])

  const collectionCount = useMemo(() => new Set(nfts.nfts.map((nft) => nft.collectionName).filter(Boolean)).size, [nfts.nfts])
  const activityStatus: SourceStatus = activity.target.kind !== 'ready' ? (activity.target.kind === 'no-wallet' ? 'idle' : activity.target.kind === 'invalid-address' ? 'unavailable' : 'unsupported')
    : activity.error && !activity.loaded ? 'unavailable' : activity.loaded ? (activity.error ? 'stale' : activity.items.length === 0 ? 'empty' : 'live') : 'loading'

  const stats = useMemo(() => {
    const { tokenView, nftView } = portfolio
    const tokenStatus = solanaOnly ? 'unsupported' : tokenView.status
    const nftStatus = solanaOnly ? 'unsupported' : nftView.status
    if (!stageReady) {
      // Wrong or unverified network: no counts exist, and the sub-line names the real problem instead of a data status.
      const reason = networkStatusLabel(stageVerification.status)
      return [
        { id: 'tokens', label: 'Tokens', value: solanaOnly ? 'N/A' : '—', sub: reason, loading: false, target: 'wlt-tokens' },
        { id: 'nfts', label: 'NFTs', value: solanaOnly ? 'N/A' : '—', sub: reason, loading: false, target: 'wlt-nfts' },
        { id: 'collections', label: 'Collections', value: solanaOnly ? 'N/A' : '—', sub: reason, loading: false, target: 'wlt-nfts' },
        { id: 'activity', label: 'Activity', value: '—', sub: reason, loading: false, target: 'wlt-activity' },
      ]
    }
    return [
      { id: 'tokens', label: 'Tokens', value: countText(tokenView, solanaOnly), sub: tokenStatus === 'live' ? 'ERC-20 loaded' : SOURCE_LABEL[tokenStatus], loading: tokenStatus === 'loading', target: 'wlt-tokens' },
      { id: 'nfts', label: 'NFTs', value: countText(nftView, solanaOnly), sub: nftStatus === 'live' ? 'Collectibles loaded' : SOURCE_LABEL[nftStatus], loading: nftStatus === 'loading', target: 'wlt-nfts' },
      { id: 'collections', label: 'Collections', value: solanaOnly ? 'N/A' : nftView.count === null ? '—' : `${collectionCount}${nftView.more ? '+' : ''}`, sub: nftStatus === 'live' ? 'Named, among loaded' : SOURCE_LABEL[nftStatus], loading: nftStatus === 'loading', target: 'wlt-nfts' },
      { id: 'activity', label: 'Activity', value: activity.loaded ? `${activity.items.length}${activity.hasMore ? '+' : ''}` : '—', sub: activityStatus === 'live' ? 'Transactions loaded' : SOURCE_LABEL[activityStatus], loading: activityStatus === 'loading', target: 'wlt-activity' },
    ]
  }, [portfolio, solanaOnly, stageReady, stageVerification.status, collectionCount, activity.loaded, activity.items.length, activity.hasMore, activityStatus])

  const hueAddress = selected === 'ton' || selected === 'tron' ? wallet.address : stageAddress
  const hues = hueAddress ? identityHues(hueAddress) : BRAND_HUES

  return (
    <div className="wlt-page" style={{ '--h1': hues.a, '--h2': hues.b } as React.CSSProperties}>
      <div className="wlt-shell wlx-shell">

        {/* A. Compact page header: title, connect action, connection summary */}
        <WalletsHeader counts={counts} onOpenConnect={() => setConnectModalOpen(true)} />

        {/* Unified connection modal */}
        <UnifiedConnectionModal open={connectModalOpen} onOpenChange={setConnectModalOpen} ton={tonSummary} />

        {/* B. Workspace: ecosystem rail + one stage for the selected ecosystem */}
        <WalletWorkspace
          ton={tonSummary}
          selected={selected}
          onSelect={setSelected}
          onJump={jump}
          onOpenConnect={() => setConnectModalOpen(true)}
          evmPanel={connected ? (
            <>
              <EvmWalletDetails ecosystem={stageEcosystem} portfolio={portfolio} copy={copy} stats={stats} onJump={jump} onSolanaTransferSettled={activity.refresh} onEvmTransferSettled={activity.refresh} />

              {/* Holdings: tokens and NFTs */}
              <div className="wlt-holdings-grid">
                <div id="wlt-tokens" className="wlt-col wlt-col--tokens" tabIndex={-1}>
                  {!stageReady ? (
                    <WrongNetworkNotice label="Tokens" message={stageVerification.message} />
                  ) : solanaOnly ? (
                    <section className="wlt-section wlt-section--tokens" aria-label="Tokens">
                      <div className="wlt-state is-info" role="status">
                        <div className="wlt-state__body">
                          <strong>SPL tokens are not supported yet</strong>
                          <p>Your Solana account's native SOL balance is shown above. Token balances are only read for Ethereum-compatible wallets, so nothing is listed here rather than an incomplete list.</p>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <WalletTokensView
                      target={tokens.target} chainName={evmChain?.shortName ?? null} explorerUrl={evmChain?.explorerUrl ?? null}
                      tokens={tokens.tokens} nextPageKey={tokens.nextPageKey} metadataPartial={tokens.metadataPartial}
                      loading={tokens.loading} loadingMore={tokens.loadingMore} loaded={tokens.loaded} error={tokens.error} moreError={tokens.moreError}
                      onRefresh={tokens.refresh} onLoadMore={tokens.loadMore}
                    />
                  )}
                </div>
                <div id="wlt-nfts" className="wlt-col wlt-col--nfts" tabIndex={-1}>
                  {!stageReady ? (
                    <WrongNetworkNotice label="NFTs" message={stageVerification.message} />
                  ) : solanaOnly ? (
                    <section className="wlt-section wlt-section--nfts" aria-label="NFTs">
                      <div className="wlt-state is-info" role="status">
                        <div className="wlt-state__body">
                          <strong>Solana NFTs are not supported yet</strong>
                          <p>NFTs are only read for Ethereum-compatible wallets, so none are listed for your Solana account.</p>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <WalletNftsView
                      target={nfts.target} chainName={wallet.network?.shortName ?? null} solanaConnected={wallet.solanaAddress !== null}
                      nfts={nfts.nfts} nextPageKey={nfts.nextPageKey} hiddenSpam={nfts.hiddenSpam}
                      loading={nfts.loading} loadingMore={nfts.loadingMore} loaded={nfts.loaded} error={nfts.error} moreError={nfts.moreError}
                      onRefresh={nfts.refresh} onLoadMore={nfts.loadMore}
                    />
                  )}
                </div>
              </div>

              {/* Activity */}
              <div id="wlt-activity" className="wlt-col wlt-col--activity" tabIndex={-1}>
                {stageReady ? <WalletActivityPanel activity={activity} /> : <WrongNetworkNotice label="Recent activity" message={stageVerification.message} />}
              </div>
            </>
          ) : null}
          tronPanel={<TronWalletPanel copy={copy} />}
          tonPanel={<TonWalletSlot copy={copy} onReport={reportTon} />}
        />

        <footer className="wlt-footer"><span><ShieldCheck size={14} aria-hidden="true" />Your wallet, your keys.</span><span>Wallet connection is optional across NEXORA.</span></footer>
      </div>
    </div>
  )
}
