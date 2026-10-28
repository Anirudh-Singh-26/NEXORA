import { Check, ExternalLink, LoaderCircle, Minus, Power, ShieldCheck, TriangleAlert, Wallet as WalletIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useWallet } from '@/features/wallet-provider'
import { useTronWallet } from '@/features/tron/tron-provider'
import type { ChainConnectionSummary, ConnectionCounts } from '@/features/wallet/wallet-connections'
import { StatusBadge, type BadgeTone } from '@/features/wallet/wallet-ui'
import { describeNetwork, shortenAddress } from '@/features/wallet/wallet-utils'
import { shortenTronAddress } from '@/lib/tron/format'
import { TRON_NETWORK_LABEL } from '@/lib/tron/network'
import {
  networkFor,
  verifyEvmNetwork,
  verifySolanaNetwork,
  verifyTonNetwork,
  verifyTronNetwork,
  networkStatusLabel,
} from '@/lib/network/environments'

/* -------------------------------------------------------------------------- */
/* A. Compact page header                                                       */
/* -------------------------------------------------------------------------- */

export function WalletsHeader({ counts, onOpenConnect }: { counts: ConnectionCounts; onOpenConnect?: () => void }) {
  return (
    <header className="wlx-header">
      <div className="wlx-header__text">
        <h1 id="wlt-title">Wallets</h1>
        <p>Connect wallets across chains to see balances, tokens, NFTs and activity in one place. Each wallet connects on its own.</p>
      </div>
      <div className="wlx-header__ctrls">
        <p className="wlx-summary" role="status">
          <span className="wlx-meter" aria-hidden="true">
            {Array.from({ length: counts.total }, (_, index) => <i key={index} className={index < counts.connected ? 'is-on' : ''} />)}
          </span>
          <span><strong>{counts.connected} of {counts.total}</strong> connected{counts.checking ? ' · checking TON…' : ''}</span>
        </p>
        {onOpenConnect && (
          <button
            type="button"
            className="wlt-btn wlt-btn--primary wlx-connect-trigger"
            onClick={onOpenConnect}
            id="wlt-connect-all-btn"
          >
            <WalletIcon size={14} aria-hidden="true" />
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/* B. Wallet overview                                                           */
/* -------------------------------------------------------------------------- */

export type EcosystemId = 'ethereum' | 'solana' | 'ton' | 'tron'

interface EcosystemView {
  id: EcosystemId
  glyph: string
  name: string
  description: string
  connected: boolean
  badge: { tone: BadgeTone; label: string }
  /** Short line under the name in the rail: the public address while connected, else the supported test network. */
  railSub: string
  walletName: string | null
  networkText: string | null
  intended: ReactNode
  note: ReactNode
  actions: ReactNode
}

/**
 * Visual state only, derived from the already-computed badge: connected, mismatch (connected on the wrong network),
 * busy (connecting / checking), unavailable (not configured, setup needed or unavailable) or idle.
 */
function cardState(connected: boolean, tone: BadgeTone): string {
  if (connected) return tone === 'connected' ? 'is-connected' : 'is-mismatch'
  if (tone === 'busy') return 'is-busy'
  if (tone === 'warn' || tone === 'error') return 'is-unavailable'
  return 'is-idle'
}

function NetworkTag({ ecosystem }: { ecosystem: 'evm' | 'solana' | 'ton' | 'tron' }) {
  const net = networkFor(ecosystem)
  return (
    <span className="wlx-env-tag" aria-label={`Supported network: ${net.fullName}`}>
      <i aria-hidden="true" className="is-testnet" />
      {net.label}
    </span>
  )
}

const ECO_FEATURES: Record<'ethereum' | 'solana', { label: string; on: boolean }[]> = {
  ethereum: [
    { label: 'Native ETH balance', on: true },
    { label: 'ERC-20 token balances', on: true },
    { label: 'NFTs by collection', on: true },
    { label: 'Recent transaction activity', on: true },
  ],
  solana: [
    { label: 'Native SOL balance', on: true },
    { label: 'Recent transaction activity (Devnet)', on: true },
    { label: 'Send SOL (Devnet)', on: true },
    { label: 'SPL tokens (not supported yet)', on: false },
    { label: 'NFTs (not supported yet)', on: false },
  ],
}

/**
 * The Wallets workspace: a rail that lists the four ecosystems with their real connection state, and one stage that
 * shows the selected ecosystem (identity, verified network, actions, then its own details). Every panel stays mounted
 * and is only hidden when not selected, so providers, summaries and data hooks behave exactly as before.
 */
export function WalletWorkspace({ ton, selected, onSelect, onJump, onOpenConnect, evmPanel, tronPanel, tonPanel }: {
  ton: ChainConnectionSummary
  selected: EcosystemId
  onSelect: (id: EcosystemId) => void
  onJump: (id: string) => void
  onOpenConnect?: () => void
  evmPanel: ReactNode
  tronPanel: ReactNode
  tonPanel: ReactNode
}) {
  const wallet = useWallet()
  const tron = useTronWallet()

  /* 1. Ethereum (Reown AppKit wagmi) */
  const evmConnected = wallet.evmAddress !== null
  const evmVer = verifyEvmNetwork(wallet.chainId)
  const evmNetwork = evmConnected ? describeNetwork(wallet, 'evm') : null
  const evmBadge = evmConnected
    ? evmVer.status === 'verified'
      ? { tone: 'connected' as const, label: 'Connected' }
      : { tone: 'warn' as const, label: evmVer.status === 'unverified' ? 'Network unverified' : 'Network mismatch' }
    : wallet.isEvmConnecting ? { tone: 'busy' as const, label: 'Connecting…' }
    : !wallet.isAvailable ? { tone: 'warn' as const, label: 'Not configured' }
    : { tone: 'idle' as const, label: 'Not connected' }

  /* 2. Solana (Reown AppKit Solana) */
  const solConnected = wallet.solanaAddress !== null
  const solVer = verifySolanaNetwork(wallet.solanaNetworkName)
  const solBadge = solConnected
    ? solVer.status === 'verified'
      ? { tone: 'connected' as const, label: 'Connected' }
      : { tone: 'warn' as const, label: solVer.status === 'unverified' ? 'Network unverified' : 'Network mismatch' }
    : wallet.isSolanaConnecting ? { tone: 'busy' as const, label: 'Connecting…' }
    : !wallet.isAvailable ? { tone: 'warn' as const, label: 'Not configured' }
    : { tone: 'idle' as const, label: 'Not connected' }

  /* 3. TON (TON Connect: owned by the lazily loaded TON section, which reports its state) */
  const tonConnected = ton.phase === 'connected' && ton.address !== null
  // Only what the wallet actually reported: a missing chain is "unverified", never guessed from a label or support flag.
  const tonVer = verifyTonNetwork(ton.chain ?? null, ton.networkKind ?? null)
  const tonBadge = tonConnected
    ? tonVer.status === 'verified'
      ? { tone: 'connected' as const, label: 'Connected' }
      : { tone: 'warn' as const, label: networkStatusLabel(tonVer.status) }
    : ton.phase === 'connecting' ? { tone: 'busy' as const, label: 'Connecting…' }
    : ton.phase === 'checking' ? { tone: 'busy' as const, label: 'Checking…' }
    : ton.phase === 'setup' ? { tone: 'warn' as const, label: 'Setup needed' }
    : ton.phase === 'unavailable' ? { tone: 'warn' as const, label: 'Unavailable' }
    : { tone: 'idle' as const, label: 'Not connected' }

  /* 4. TRON (TronLink) */
  const tronConnected = tron.status === 'connected' && tron.address !== null
  const tronBusy = tron.status === 'connecting' || tron.status === 'disconnecting'
  const tronWalletNet = tron.network
  const tronIdentity = tronWalletNet.status === 'ready' ? tronWalletNet.identity : null
  const tronVer = verifyTronNetwork(tronIdentity)
  const tronBadge = tronConnected
    ? tronVer.status === 'verified'
      ? { tone: 'connected' as const, label: 'Connected' }
      : { tone: 'warn' as const, label: networkStatusLabel(tronVer.status) }
    : tron.status === 'connecting' ? { tone: 'busy' as const, label: 'Connecting…' }
    : { tone: 'idle' as const, label: 'Not connected' }
  const tronNetLabel = !tronConnected ? null
    : tronWalletNet.status === 'ready' ? TRON_NETWORK_LABEL[tronWalletNet.identity.kind]
    : tronWalletNet.status === 'error' ? 'Network unverified' : 'Identifying network…'
  const tronNetOk = tronConnected && tronVer.status === 'verified'

  const evmNet = networkFor('evm')
  const solNet = networkFor('solana')
  const tonNet = networkFor('ton')
  const tronNet = networkFor('tron')

  const views: EcosystemView[] = [
    {
      id: 'ethereum', glyph: 'Ξ', name: 'Ethereum',
      description: `Reown AppKit · ${evmNet.fullName}. Reads your ETH balance, ERC-20 tokens, NFTs and activity.`,
      connected: evmConnected, badge: evmBadge,
      railSub: evmConnected && wallet.evmAddress ? shortenAddress(wallet.evmAddress, 6, 4) : evmNet.fullName,
      walletName: evmConnected ? (wallet.evmWalletName ?? 'EVM wallet') : null,
      networkText: evmConnected ? (wallet.chainId === null ? 'Unknown network' : (evmNetwork?.label ?? evmVer.reportedName ?? `Chain ${wallet.chainId}`)) : null,
      intended: <NetworkTag ecosystem="evm" />,
      note: evmConnected && evmVer.status !== 'verified' && evmVer.message ? (
        <p className="wlx-card__note"><TriangleAlert size={14} aria-hidden="true" /><span>{evmVer.message}</span></p>
      ) : !evmConnected && !wallet.isAvailable ? (
        <p className="wlx-card__note"><TriangleAlert size={14} aria-hidden="true" /><span>Not configured for this build (missing <code>VITE_REOWN_PROJECT_ID</code>).</span></p>
      ) : null,
      actions: evmConnected ? (
        <button type="button" className="wlt-btn wlt-btn--sm wlt-btn--quiet" onClick={() => void wallet.disconnectEvm()} disabled={wallet.disconnectingEcosystem !== null} aria-busy={wallet.disconnectingEcosystem === 'evm' || wallet.disconnectingEcosystem === 'all'}><Power size={14} aria-hidden="true" />Disconnect</button>
      ) : (
        <button type="button" className="wlt-btn wlt-btn--sm" onClick={() => void wallet.connectEvm()} disabled={wallet.isEvmConnecting} aria-busy={wallet.isEvmConnecting}>
          {wallet.isEvmConnecting ? <LoaderCircle className="wlt-spin" size={14} aria-hidden="true" /> : <WalletIcon size={14} aria-hidden="true" />}
          {wallet.isEvmConnecting ? 'Waiting for wallet…' : 'Connect Ethereum'}
        </button>
      ),
    },
    {
      id: 'solana', glyph: '◎', name: 'Solana',
      description: `Reown AppKit · ${solNet.fullName}. Reads your native SOL balance and history, and sends SOL after you approve in your wallet.`,
      connected: solConnected, badge: solBadge,
      railSub: solConnected && wallet.solanaAddress ? shortenAddress(wallet.solanaAddress, 6, 4) : solNet.fullName,
      walletName: solConnected ? (wallet.solanaWalletName ?? 'Solana wallet') : null,
      networkText: solConnected ? (solVer.reportedName ?? 'Unknown network') : null,
      intended: <NetworkTag ecosystem="solana" />,
      note: solConnected && solVer.status !== 'verified' && solVer.message ? (
        <p className="wlx-card__note"><TriangleAlert size={14} aria-hidden="true" /><span>{solVer.message}</span></p>
      ) : !solConnected && !wallet.isAvailable ? (
        <p className="wlx-card__note"><TriangleAlert size={14} aria-hidden="true" /><span>Not configured for this build (missing <code>VITE_REOWN_PROJECT_ID</code>).</span></p>
      ) : null,
      actions: solConnected ? (
        <button type="button" className="wlt-btn wlt-btn--sm wlt-btn--quiet" onClick={() => void wallet.disconnectSolana()} disabled={wallet.disconnectingEcosystem !== null} aria-busy={wallet.disconnectingEcosystem === 'solana' || wallet.disconnectingEcosystem === 'all'}><Power size={14} aria-hidden="true" />Disconnect</button>
      ) : (
        <button type="button" className="wlt-btn wlt-btn--sm" onClick={() => void wallet.connectSolana()} disabled={wallet.isSolanaConnecting} aria-busy={wallet.isSolanaConnecting}>
          {wallet.isSolanaConnecting ? <LoaderCircle className="wlt-spin" size={14} aria-hidden="true" /> : <WalletIcon size={14} aria-hidden="true" />}
          {wallet.isSolanaConnecting ? 'Waiting for wallet…' : 'Connect Solana'}
        </button>
      ),
    },
    {
      id: 'ton', glyph: 'TON', name: 'TON',
      description: `TON Connect · ${tonNet.fullName}. Reads your TON balance and sends test TON.`,
      connected: tonConnected, badge: tonBadge,
      railSub: tonConnected && ton.address ? shortenAddress(ton.address, 6, 4) : tonNet.fullName,
      walletName: tonConnected ? (ton.walletName ?? 'TON wallet') : null,
      networkText: tonConnected ? `${ton.networkLabel ?? 'Not reported'}${ton.networkSupported === false ? ' (transfers off)' : ''}` : null,
      intended: <NetworkTag ecosystem="ton" />,
      note: tonConnected && tonVer.status !== 'verified' && tonVer.message ? (
        <p className="wlx-card__note"><TriangleAlert size={14} aria-hidden="true" /><span>{tonVer.message}</span></p>
      ) : null,
      actions: tonConnected ? (
        <button type="button" className="wlt-btn wlt-btn--sm wlt-btn--quiet" onClick={() => ton.disconnect?.()} disabled={ton.disconnect === null || ton.disconnecting}><Power size={14} aria-hidden="true" />Disconnect</button>
      ) : ton.phase === 'setup' ? (
        <button type="button" className="wlt-btn wlt-btn--sm" onClick={() => onJump('wlt-ton')}>View setup steps</button>
      ) : (
        <button type="button" className="wlt-btn wlt-btn--sm" onClick={() => ton.connect ? ton.connect() : onOpenConnect?.()} disabled={ton.connect === null || ton.phase === 'connecting' || ton.phase === 'checking' || ton.phase === 'unavailable'} aria-busy={ton.phase === 'connecting'}>
          {ton.phase === 'connecting' || ton.phase === 'checking' ? <LoaderCircle className="wlt-spin" size={14} aria-hidden="true" /> : <WalletIcon size={14} aria-hidden="true" />}
          {ton.phase === 'connecting' ? 'Choose a wallet…' : ton.phase === 'checking' ? 'Checking…' : ton.phase === 'unavailable' ? 'Unavailable' : 'Connect TON wallet'}
        </button>
      ),
    },
    {
      id: 'tron', glyph: 'TRX', name: 'TRON',
      description: `TronLink · ${tronNet.fullName}. Reads your TRX balance and sends test TRX.`,
      connected: tronConnected, badge: tronBadge,
      railSub: tronConnected && tron.address ? shortenTronAddress(tron.address, 6, 4) : tronNet.fullName,
      walletName: tronConnected ? (tron.walletName ?? 'TronLink') : null,
      networkText: tronConnected ? `${tronNetLabel}${tronNetOk ? '' : ' (transfers off)'}` : null,
      intended: <NetworkTag ecosystem="tron" />,
      note: tronConnected && tronVer.status !== 'verified' && tronVer.message ? (
        <p className="wlx-card__note"><TriangleAlert size={14} aria-hidden="true" /><span>{tronVer.message}</span></p>
      ) : !tronConnected && tron.availability === 'not-installed' ? (
        <p className="wlx-card__note"><TriangleAlert size={14} aria-hidden="true" /><span>TronLink was not detected in this browser. {tron.walletUrl && <a className="wlt-link" href={tron.walletUrl} target="_blank" rel="noopener noreferrer">Get TronLink<ExternalLink size={12} aria-hidden="true" /></a>} Reload after installing or unlocking it.</span></p>
      ) : null,
      actions: tronConnected ? (
        <>
          {tronVer.status === 'mismatch' && (
            <button type="button" className="wlt-btn wlt-btn--sm" onClick={() => void tron.switchToShasta()} disabled={tron.switching} aria-busy={tron.switching}>
              Switch to Shasta
            </button>
          )}
          <button type="button" className="wlt-btn wlt-btn--sm wlt-btn--quiet" onClick={() => void tron.disconnect()} disabled={tronBusy}><Power size={14} aria-hidden="true" />Disconnect</button>
        </>
      ) : (
        <button type="button" className="wlt-btn wlt-btn--sm" onClick={() => void tron.connect()} disabled={tronBusy || tron.availability !== 'available'} aria-busy={tron.status === 'connecting'}>
          {tron.status === 'connecting' ? <LoaderCircle className="wlt-spin" size={14} aria-hidden="true" /> : <WalletIcon size={14} aria-hidden="true" />}
          {tron.status === 'connecting' ? 'Waiting for TronLink…' : tron.availability === 'checking' ? 'Looking for TronLink…' : 'Connect TronLink'}
        </button>
      ),
    },
  ]

  const current = views.find((view) => view.id === selected) ?? views[0]
  const state = cardState(current.connected, current.badge.tone)
  const isEvmFamily = current.id === 'ethereum' || current.id === 'solana'

  return (
    <div className="wlx-workspace">
      {/* Rail: all four ecosystems, always visible, each with its real status */}
      <aside className="wlx-rail" aria-labelledby="wlx-rail-title">
        <div className="wlx-rail__head">
          <h2 className="wlx-label" id="wlx-rail-title">Ecosystems</h2>
          <span className="wlx-env-hint" aria-live="polite">Testnets only · no real value</span>
        </div>
        <ul className="wlx-rail__list">
          {views.map((view) => (
            <li key={view.id}>
              <button
                type="button"
                className={`wlx-rail__item ${cardState(view.connected, view.badge.tone)}`}
                data-eco={view.id}
                aria-pressed={view.id === current.id}
                onClick={() => onSelect(view.id)}
              >
                <span className="wlx-glyph wlx-glyph--sm" aria-hidden="true">{view.glyph}</span>
                <span className="wlx-rail__name">{view.name}</span>
                <span className="wlx-rail__sub" title={view.connected ? 'Connected account' : 'Supported network'}>{view.railSub}</span>
                <StatusBadge tone={view.badge.tone}>{view.badge.label}</StatusBadge>
              </button>
            </li>
          ))}
        </ul>
        <p className="wlx-rail__foot"><ShieldCheck size={14} aria-hidden="true" />Public-address access only. Your keys stay in your wallet.</p>
      </aside>

      {/* Stage: the selected ecosystem */}
      <section className="wlx-stage" data-eco={current.id} aria-labelledby="wlx-stage-title" aria-busy={current.badge.tone === 'busy' ? true : undefined}>
        <header className={`wlx-stage__head ${state}`}>
          <span className="wlx-glyph wlx-glyph--lg is-detail" aria-hidden="true">{current.glyph}</span>
          <div className="wlx-stage__title">
            <div className="wlx-stage__name">
              <h2 id="wlx-stage-title">{current.name}</h2>
              <StatusBadge tone={current.badge.tone}>{current.badge.label}</StatusBadge>
            </div>
            <p>{current.description}</p>
          </div>
          <div className="wlx-stage__actions">{current.actions}</div>
          <dl className="wlx-meta">
            {current.walletName !== null && <div><dt>Wallet</dt><dd>{current.walletName}</dd></div>}
            {current.networkText !== null && <div><dt>Wallet network</dt><dd>{current.networkText}</dd></div>}
            <div><dt>Supported network</dt><dd>{current.intended}</dd></div>
          </dl>
        </header>

        {current.note}

        {/* Ethereum / Solana share one panel slot; its content is driven by the selected stage's own account, not AppKit's active one */}
        <div className="wlx-stage__body" hidden={!isEvmFamily || !current.connected}>
          {evmPanel}
        </div>
        {isEvmFamily && !current.connected && (
          <div className="wlx-empty">
            <span className="wlx-glyph wlx-glyph--lg wlx-empty__glyph" aria-hidden="true">{current.glyph}</span>
            <h3>{current.badge.tone === 'warn' ? `${current.name} is not available yet` : `No ${current.name} wallet connected`}</h3>
            <p>Connect to read your public {current.name} account. NEXORA never asks you to sign or send anything from this page.</p>
            <ul className="wlx-empty__list">
              {ECO_FEATURES[current.id as 'ethereum' | 'solana'].map((feature) => (
                <li key={feature.label} className={feature.on ? 'is-on' : 'is-off'}>
                  {feature.on ? <Check size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}{feature.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="wlx-stage__body" hidden={current.id !== 'ton'}>{tonPanel}</div>
        <div className="wlx-stage__body" hidden={current.id !== 'tron'}>{tronPanel}</div>
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* C. Shared wallet-details frame (EVM/Solana, TRON and TON all use it)         */
/* -------------------------------------------------------------------------- */

export function WalletDetail({ id, titleId, className = '', glyph, title, subtitle, badges, actions, footer, children }: {
  id: string
  className?: string
  titleId: string
  glyph: string
  title: string
  subtitle: string
  badges: React.ReactNode
  actions?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={id} className={`wlx-detail ${className}`} aria-labelledby={titleId} tabIndex={-1}>
      <header className="wlx-detail__head">
        <span className={`wlx-glyph wlx-glyph--${glyph.length > 1 ? 'sm' : 'lg'} is-detail`} aria-hidden="true">{glyph}</span>
        <div className="wlx-detail__title">
          <h2 id={titleId}>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="wlx-detail__badges">{badges}</div>
        {actions ? <div className="wlx-detail__actions">{actions}</div> : null}
      </header>
      {children}
      {footer ? <footer className="wlx-detail__foot">{footer}</footer> : null}
    </section>
  )
}

/** Two columns on wide screens (read-only wallet information | actions), stacked on narrow ones. */
export function DetailColumns({ info, action }: { info: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={`wlx-cols ${action ? '' : 'is-single'}`}>
      <div className="wlx-cols__info">{info}</div>
      {action ? <div className="wlx-cols__action">{action}</div> : null}
    </div>
  )
}
