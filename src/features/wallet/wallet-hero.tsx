import { ArrowUpRight, CircleAlert, LoaderCircle, Power, RefreshCw, ShieldCheck, Wallet as WalletIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CopyButton, type CopyController } from '@/features/wallet/wallet-copy'
import { SolanaBalanceCard } from '@/features/wallet/solana-balance-card'
import { WalletBalanceCard } from '@/features/wallet/wallet-balance-card'
import { WalletOrb } from '@/features/wallet/wallet-orb'
import { SourcePill } from '@/features/wallet/wallet-ui'
import { describeNetwork, ECOSYSTEM_LABEL, identityGradient, shortenAddress } from '@/features/wallet/wallet-utils'
import type { WalletPortfolio } from '@/features/wallet/use-wallet-portfolio'
import { BRAND_HUES, identityHues, type OrbNode } from '@/lib/wallet/orb-model'

export interface StageStat {
  id: string
  label: string
  value: string
  sub: string
  loading?: boolean
  /** Section the stat jumps to; omitted for stats that are not a section. */
  target?: string
}

function Readout({ stats, onJump }: { stats: StageStat[]; onJump: (target: string) => void }) {
  return (
    <dl className="wlt-readout">
      {stats.map((stat) => {
        const inner = (
          <>
            <dt>{stat.label}{stat.target ? <ArrowUpRight size={11} aria-hidden="true" /> : null}</dt>
            <dd>{stat.loading ? <span className="wlt-skel wlt-skel--stat" role="status" aria-label={`Loading ${stat.label}`} /> : stat.value}</dd>
            <small>{stat.sub}</small>
          </>
        )
        return (
          <div key={stat.id}>
            {stat.target
              ? <button type="button" className="wlt-stat is-action" onClick={() => onJump(stat.target!)} aria-label={`${stat.label}: ${stat.value}. ${stat.sub}. Jump to ${stat.label}`}>{inner}</button>
              : <div className="wlt-stat">{inner}</div>}
          </div>
        )
      })}
    </dl>
  )
}

interface StageProps {
  portfolio: WalletPortfolio
  copy: CopyController
  stats: StageStat[]
  orbNodes: OrbNode[]
  orbSummary: string
  onJump: (target: string) => void
  onSelectOrbNode?: (node: OrbNode) => void
}

/** Connected: identity, the real native balance as the focal figure, a readout of real counts and the orb. */
function Stage({ portfolio, copy, stats, orbNodes, orbSummary, onJump, onSelectOrbNode }: StageProps) {
  const { wallet, evmNative, solNative, evmFreshWallet } = portfolio
  const network = describeNetwork(wallet)
  const address = wallet.address!
  const ecosystem = wallet.ecosystem!
  const hues = identityHues(address)
  const figures = (ecosystem === 'solana' ? [solNative, evmNative] : [evmNative, solNative]).filter((view) => view !== null)
  const primaryNative = figures[0]

  return (
    <header className="wlt-stage" style={{ '--h1': hues.a, '--h2': hues.b } as React.CSSProperties} aria-labelledby="wlt-title">
      <div className="wlt-stage__atmos" aria-hidden="true" />
      <div className="wlt-stage__copy">
        <nav className="wlt-crumbs" aria-label="Breadcrumb"><Link to="/discover">Discover</Link><span aria-hidden="true">/</span><span aria-current="page">Wallets</span></nav>
        <div className="wlt-id">
          <span className="wlt-avatar" style={{ background: identityGradient(address) }} aria-hidden="true" />
          <div className="wlt-id__text">
            <p className="wlt-kicker"><span aria-hidden="true" />Connected · {ECOSYSTEM_LABEL[ecosystem]}</p>
            <h1 id="wlt-title">{wallet.providerName ?? 'Connected wallet'}</h1>
            <div className="wlt-address">
              <code title={address}>{shortenAddress(address, 8, 6)}</code>
              <CopyButton address={address} copy={copy} label={`${ECOSYSTEM_LABEL[ecosystem]} account`} />
              <span className={`wlt-chip is-${network.tone}`}><i aria-hidden="true" />{network.label}</span>
            </div>
          </div>
        </div>

        <div className={`wlt-figures ${figures.length > 1 ? 'is-pair' : ''}`}>
          {figures.map((view, index) => (
            view.ecosystem === 'solana'
              ? <SolanaBalanceCard key="sol" view={view} primary={index === 0} />
              : <WalletBalanceCard key="evm" view={view} primary={index === 0} />
          ))}
        </div>

        {evmFreshWallet && (
          <p className="wlt-fresh" role="status">
            A clean slate on {evmNative?.networkName}: native balance, tokens and NFTs all came back empty. Holdings appear as soon as this address receives them; other networks show up when you switch in your wallet.
          </p>
        )}
        {network.tone === 'warn' && <p className="wlt-warn"><CircleAlert size={14} aria-hidden="true" /><span>{network.detail}</span></p>}

        <Readout stats={stats} onJump={onJump} />

        <div className="wlt-actions">
          <button className="wlt-btn wlt-btn--primary" type="button" onClick={portfolio.refreshAll} disabled={portfolio.refreshing} aria-busy={portfolio.refreshing}>
            <RefreshCw size={15} className={portfolio.refreshing ? 'wlt-spin' : ''} aria-hidden="true" />{portfolio.refreshing ? 'Refreshing…' : 'Refresh all'}
          </button>
          <button className="wlt-btn" type="button" onClick={() => void wallet.connect()}><WalletIcon size={15} aria-hidden="true" />Wallet options</button>
          <button className="wlt-btn wlt-btn--quiet" type="button" onClick={() => void wallet.disconnect()}><Power size={15} aria-hidden="true" />Disconnect</button>
        </div>
      </div>

      <div className="wlt-stage__orb">
        <WalletOrb
          seed={address}
          glyph={ecosystem === 'solana' ? '◎' : 'Ξ'}
          caption={primaryNative?.networkName ?? network.label}
          captionSub={primaryNative ? primaryNative.symbol : null}
          nodes={orbNodes}
          summary={orbSummary}
          onSelectNode={onSelectOrbNode}
          onSelectRing={(ring) => onJump(ring === 'tokens' ? 'wlt-tokens' : ring === 'nfts' ? 'wlt-nfts' : 'wlt-network')}
        />
        <p className="wlt-stage__status"><SourcePill status={primaryNative?.status ?? 'idle'} label={primaryNative ? `${primaryNative.symbol} balance` : undefined} /></p>
      </div>
    </header>
  )
}

/** Disconnected: one confident statement, one action, and a dormant orb ringed only by the networks NEXORA understands. */
function Landing({ portfolio, orbNodes, orbSummary, onSelectOrbNode }: { portfolio: WalletPortfolio; orbNodes: OrbNode[]; orbSummary: string; onSelectOrbNode?: (node: OrbNode) => void }) {
  const { wallet } = portfolio
  return (
    <header className="wlt-stage wlt-stage--landing" style={{ '--h1': BRAND_HUES.a, '--h2': BRAND_HUES.b } as React.CSSProperties} aria-labelledby="wlt-title">
      <div className="wlt-stage__atmos" aria-hidden="true" />
      <div className="wlt-stage__copy">
        <nav className="wlt-crumbs" aria-label="Breadcrumb"><Link to="/discover">Discover</Link><span aria-hidden="true">/</span><span aria-current="page">Wallets</span></nav>
        <p className="wlt-kicker"><span aria-hidden="true" />{wallet.isConnecting ? 'Waiting for your wallet' : 'Wallets'}</p>
        <h1 id="wlt-title">Your wallet,<br /><em>read-only.</em></h1>
        <p className="wlt-deck">Connect an Ethereum-compatible or Solana wallet and NEXORA lays out its native balance, tokens, NFTs by collection and recent activity. It uses only your public address.</p>
        <div className="wlt-actions">
          <button className="wlt-btn wlt-btn--primary wlt-btn--lg" type="button" onClick={() => void wallet.connect()} aria-busy={wallet.isConnecting}>
            {wallet.isConnecting ? <LoaderCircle className="wlt-spin" size={17} aria-hidden="true" /> : <WalletIcon size={17} aria-hidden="true" />}
            {wallet.isConnecting ? 'Waiting for wallet…' : 'Connect wallet'}
            {!wallet.isConnecting && <ArrowUpRight size={15} aria-hidden="true" />}
          </button>
        </div>
        {!wallet.isAvailable && (
          <p className="wlt-warn"><CircleAlert size={14} aria-hidden="true" /><span>Wallet connections are not configured for this build (missing <code>VITE_REOWN_PROJECT_ID</code>). Selecting Connect explains how to enable them.</span></p>
        )}
        <p className="wlt-trust"><ShieldCheck size={14} aria-hidden="true" />No seed phrase. No private keys. No transaction signing.</p>
      </div>
      <div className="wlt-stage__orb">
        <WalletOrb
          seed={null}
          glyph="NX"
          caption="Not connected"
          captionSub={null}
          nodes={orbNodes}
          summary={orbSummary}
          onSelectNode={onSelectOrbNode}
        />
      </div>
    </header>
  )
}

export function WalletHero({ portfolio, copy, stats, orbNodes, orbSummary, onJump, onSelectOrbNode }: StageProps) {
  const { wallet } = portfolio
  return (
    <>
      {wallet.address !== null
        ? <Stage portfolio={portfolio} copy={copy} stats={stats} orbNodes={orbNodes} orbSummary={orbSummary} onJump={onJump} onSelectOrbNode={onSelectOrbNode} />
        : <Landing portfolio={portfolio} orbNodes={orbNodes} orbSummary={orbSummary} onSelectOrbNode={onSelectOrbNode} />}
      {wallet.error && (
        <div className="wlt-alert" role="alert"><CircleAlert size={16} aria-hidden="true" /><span>{wallet.error}</span><button type="button" onClick={wallet.clearError}>Dismiss</button></div>
      )}
    </>
  )
}
