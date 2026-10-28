import { CircleAlert, RefreshCw, Wallet as WalletIcon } from 'lucide-react'
import { CopyButton, type CopyController } from '@/features/wallet/wallet-copy'
import { SolanaBalanceCard } from '@/features/wallet/solana-balance-card'
import { EthBalanceCard } from '@/features/evm/eth-balance-card'
import { DetailColumns, WalletDetail } from '@/features/wallet/wallet-dashboard'
import { StatusBadge } from '@/features/wallet/wallet-ui'
import { describeNetwork, ECOSYSTEM_LABEL, identityGradient, shortenAddress } from '@/features/wallet/wallet-utils'
import type { WalletPortfolio } from '@/features/wallet/use-wallet-portfolio'
import type { WalletEcosystem } from '@/features/wallet-provider'

export interface StageStat {
  id: string
  label: string
  value: string
  sub: string
  loading?: boolean
  /** Section the stat jumps to. */
  target?: string
}

function Readout({ stats, onJump }: { stats: StageStat[]; onJump: (target: string) => void }) {
  return (
    <dl className="wlt-readout wlx-readout">
      {stats.map((stat) => {
        const inner = (
          <>
            <dt>{stat.label}</dt>
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

/**
 * Details of the connected Ethereum-compatible / Solana wallet: identity and network, the real native balance(s) and a
 * readout of counts that are actually loaded. Replaces the former full-width hero; every value still comes from the
 * same portfolio hook and connection callbacks.
 */
export function EvmWalletDetails({ ecosystem, portfolio, copy, stats, onJump, onSolanaTransferSettled, onEvmTransferSettled }: { ecosystem: WalletEcosystem; portfolio: WalletPortfolio; copy: CopyController; stats: StageStat[]; onJump: (target: string) => void; onSolanaTransferSettled?: () => void; onEvmTransferSettled?: () => void }) {
  const { wallet, evmNative, solNative } = portfolio
  // Identity comes only from the stage's own ecosystem, never from AppKit's globally active account.
  const address = ecosystem === 'solana' ? wallet.solanaAddress : wallet.evmAddress
  const providerName = ecosystem === 'solana' ? wallet.solanaWalletName : wallet.evmWalletName
  if (address === null) return null // never render stale details for a disconnected wallet
  const evmFreshWallet = ecosystem === 'evm' && portfolio.evmFreshWallet

  const network = describeNetwork(wallet, ecosystem)
  const figures = [ecosystem === 'solana' ? solNative : evmNative].filter((view) => view !== null)

  return (
    <WalletDetail
      id="wlt-evm"
      titleId="wlt-evm-title"
      glyph={ecosystem === 'solana' ? '◎' : 'Ξ'}
      title={providerName ?? 'Connected wallet'}
      subtitle={ecosystem === 'solana' ? 'Solana account · Devnet · reads balance and history, sends SOL after wallet approval' : `${ECOSYSTEM_LABEL[ecosystem]} account · Sepolia · reads balance and history, sends ETH after wallet approval`}
      badges={(
        <>
          <StatusBadge tone="connected">Connected</StatusBadge>
          <StatusBadge tone={network.tone === 'ok' ? 'info' : 'warn'}>{network.label}</StatusBadge>
        </>
      )}
      actions={(
        <>
          <button className="wlt-btn wlt-btn--sm" type="button" onClick={portfolio.refreshAll} disabled={portfolio.refreshing} aria-busy={portfolio.refreshing}>
            <RefreshCw size={14} className={portfolio.refreshing ? 'wlt-spin' : ''} aria-hidden="true" />{portfolio.refreshing ? 'Refreshing…' : 'Refresh all'}
          </button>
          <button className="wlt-btn wlt-btn--sm" type="button" onClick={() => void wallet.connect()}><WalletIcon size={14} aria-hidden="true" />Wallet options</button>
        </>
      )}
    >
      <DetailColumns
        info={(
          <>
            <div className="wlx-row">
              <span className="wlx-label">Address</span>
              <div className="wlt-address wlx-address">
                <span className="wlt-avatar wlt-avatar--sm" style={{ background: identityGradient(address) }} aria-hidden="true" />
                <code title={address}>{shortenAddress(address, 8, 6)}</code>
                <CopyButton address={address} copy={copy} label={`${ECOSYSTEM_LABEL[ecosystem]} account`} />
              </div>
            </div>
            <div className={`wlt-figures wlx-figures ${figures.length > 1 ? 'is-pair' : ''}`}>
              {figures.map((view, index) => (
                view.ecosystem === 'solana'
                  ? <SolanaBalanceCard key="sol" view={view} primary={index === 0} send={{ copy, onSettled: () => { portfolio.solBalance.refresh(); onSolanaTransferSettled?.() } }} />
                  : <EthBalanceCard key="evm" view={view} primary={index === 0} send={{ copy, onSettled: () => { portfolio.evmBalance.refresh(); onEvmTransferSettled?.() } }} />
              ))}
            </div>
            {evmFreshWallet && (
              <p className="wlt-fresh" role="status">
                A clean slate on {evmNative?.networkName}: native balance, tokens and NFTs all came back empty. Holdings appear as soon as this address receives them; other networks show up when you switch in your wallet.
              </p>
            )}
            {network.tone === 'warn' && <p className="wlt-warn"><CircleAlert size={14} aria-hidden="true" /><span>{network.detail}</span></p>}
          </>
        )}
        action={<Readout stats={stats} onJump={onJump} />}
      />
    </WalletDetail>
  )
}
