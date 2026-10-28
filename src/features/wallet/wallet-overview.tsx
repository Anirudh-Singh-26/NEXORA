import { ArrowUpRight, Check, CircleAlert, ExternalLink, Minus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SUPPORTED_WALLET_NETWORKS } from '@/features/wallet-provider'
import type { SourceStatus, WalletPortfolio } from '@/features/wallet/use-wallet-portfolio'
import { CopyButton, type CopyController } from '@/features/wallet/wallet-copy'
import { SectionHead, SourcePill } from '@/features/wallet/wallet-ui'
import { describeNetwork, ECOSYSTEM_LABEL, identityGradient, shortenAddress } from '@/features/wallet/wallet-utils'
import { evmAddressUrl } from '@/lib/wallet-activity/chains'

const STEPS = [
  { title: 'Choose a wallet', text: 'Pick an installed wallet, WalletConnect or Coinbase Wallet from the connection window.' },
  { title: 'Share a public address', text: 'NEXORA reads only the address and network. Nothing is signed or sent.' },
  { title: 'See what it holds', text: 'Balances, tokens, NFTs and activity appear for the network you are on.' },
]

/** Disconnected only: three plain steps, set as a connected sequence rather than cards. */
export function WalletSteps() {
  return (
    <section className="wlt-steps" aria-label="How connecting works">
      <ol>
        {STEPS.map((step, index) => (
          <li key={step.title}><span aria-hidden="true">0{index + 1}</span><h2>{step.title}</h2><p>{step.text}</p></li>
        ))}
      </ol>
    </section>
  )
}

const CAPABILITIES = {
  evm: [['Native balance', true], ['ERC-20 tokens', true], ['NFTs by collection', true], ['Activity', true]],
  solana: [['Native SOL balance', true], ['Activity', true], ['Send SOL (Devnet)', true], ['SPL tokens', false], ['NFTs', false]],
} as const

/** What can be connected and what each ecosystem supports. Informational only. */
export function WalletCapabilities({ portfolio }: { portfolio: WalletPortfolio }) {
  const { wallet } = portfolio
  return (
    <section className="wlt-caps" aria-label="Supported ecosystems and networks">
      <div className="wlt-rule"><span>Supported</span><em>Bitcoin wallets are not supported</em></div>
      <div className="wlt-caps__grid">
        {(['evm', 'solana'] as const).map((key) => (
          <article key={key}>
            <h2><span aria-hidden="true">{key === 'evm' ? 'Ξ' : '◎'}</span>{key === 'evm' ? 'Ethereum-compatible' : 'Solana'}</h2>
            <ul>
              {CAPABILITIES[key].map(([name, on]) => (
                <li key={name} className={on ? 'is-on' : 'is-off'}>{on ? <Check size={13} aria-hidden="true" /> : <Minus size={13} aria-hidden="true" />}<span>{name}</span><span className="wlt-sr">{on ? 'supported' : 'not supported yet'}</span></li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <ul className="wlt-nets" aria-label="EVM networks NEXORA recognises">
        {SUPPORTED_WALLET_NETWORKS.map((network) => {
          const active = wallet.evmAddress !== null && wallet.chainId === network.chainId
          return <li key={network.chainId} className={active ? 'is-active' : ''} title={`${network.name} · chain ID ${network.chainId}`}>{network.shortName}{active && <span className="wlt-sr"> (active)</span>}</li>
        })}
      </ul>
      <p className="wlt-note"><CircleAlert size={13} aria-hidden="true" />Network recognition is informational. NEXORA never switches networks for you.</p>
    </section>
  )
}

/** Connected: the active network in detail, with the networks NEXORA recognises beside it. */
export function WalletNetworkPanel({ portfolio }: { portfolio: WalletPortfolio }) {
  const { wallet } = portfolio
  const network = describeNetwork(wallet)
  const explorer = wallet.ecosystem === 'evm' && wallet.chainId !== null && wallet.evmAddress ? evmAddressUrl(wallet.chainId, wallet.evmAddress) : null
  return (
    <section className="wlt-section wlt-section--rail" id="wlt-network" aria-label="Network" tabIndex={-1}>
      <SectionHead label="Network" title={network.label} aside={<span className={`wlt-chip is-${network.tone}`}><i aria-hidden="true" />{network.status}</span>} />
      <p className="wlt-copy-text">{network.detail}</p>
      <dl className="wlt-facts">
        {wallet.ecosystem === 'evm' && wallet.chainId !== null && <div><dt>Chain ID</dt><dd>{wallet.chainId}</dd></div>}
        {wallet.network && <div><dt>Native currency</dt><dd>{wallet.network.nativeCurrency}</dd></div>}
        {explorer && <div><dt>Explorer</dt><dd><a href={explorer} target="_blank" rel="noopener noreferrer" className="wlt-link">View address<ExternalLink size={12} aria-hidden="true" /></a></dd></div>}
      </dl>
      <ul className="wlt-nets wlt-nets--rail" aria-label="EVM networks NEXORA recognises">
        {SUPPORTED_WALLET_NETWORKS.map((item) => {
          const active = wallet.evmAddress !== null && wallet.chainId === item.chainId
          return <li key={item.chainId} className={active ? 'is-active' : ''} title={`${item.name} · chain ID ${item.chainId}`}>{item.shortName}{active && <span className="wlt-sr"> (active)</span>}</li>
        })}
      </ul>
      <p className="wlt-note"><CircleAlert size={13} aria-hidden="true" />NEXORA never switches networks for you; holdings follow the network your wallet is on.</p>
    </section>
  )
}

/** Connected: every account the wallet library reports, with the active one marked. */
export function WalletAccountsPanel({ portfolio, copy }: { portfolio: WalletPortfolio; copy: CopyController }) {
  const { wallet } = portfolio
  if (wallet.accounts.length === 0) return null
  return (
    <section className="wlt-section wlt-section--rail" aria-label="Connected accounts">
      <SectionHead label="Accounts" title={`${wallet.accounts.length} connected`} />
      <ul className="wlt-accounts">
        {wallet.accounts.map((account) => {
          const active = account.address === wallet.address
          return (
            <li key={`${account.ecosystem}:${account.address}`} className={active ? 'is-active' : ''}>
              <span className="wlt-avatar wlt-avatar--sm" style={{ background: identityGradient(account.address) }} aria-hidden="true" />
              <div>
                <strong>{account.walletName ?? 'Wallet'}<em>{ECOSYSTEM_LABEL[account.ecosystem]}{active ? ' · active' : ''}</em></strong>
                <code title={account.address}>{shortenAddress(account.address, 8, 6)}</code>
              </div>
              <CopyButton address={account.address} copy={copy} label={`${ECOSYSTEM_LABEL[account.ecosystem]} account`} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Connected: where each number comes from, and what "none found" versus "unavailable" means. */
export function WalletSources({ portfolio, activityStatus }: { portfolio: WalletPortfolio; activityStatus?: SourceStatus }) {
  const { wallet, evmNative, solNative, tokenView, nftView } = portfolio
  const solanaOnly = !wallet.evmAddress && Boolean(wallet.solanaAddress)
  const rows: Array<{ name: string; detail: string; status: SourceStatus }> = []
  if (evmNative) rows.push({ name: `Native balance · ${evmNative.networkName}`, detail: 'Public RPC read by address', status: evmNative.status })
  if (solNative) rows.push({ name: 'Native SOL balance', detail: 'Read through NEXORA’s server', status: solNative.status })
  rows.push({ name: 'ERC-20 tokens', detail: solanaOnly ? 'SPL tokens are not supported yet' : 'Alchemy Token API via NEXORA', status: solanaOnly ? 'unsupported' : tokenView.status })
  rows.push({ name: 'NFTs', detail: solanaOnly ? 'Solana NFTs are not supported yet' : 'Alchemy NFT API via NEXORA', status: solanaOnly ? 'unsupported' : nftView.status })
  if (activityStatus) rows.push({ name: 'Activity', detail: solanaOnly ? 'Solana Devnet RPC via NEXORA (history and transfers)' : 'Alchemy Transfers API via NEXORA', status: activityStatus })
  return (
    <section className="wlt-section wlt-section--rail wlt-sources" aria-label="Data sources">
      <SectionHead label="Provenance" title="Data sources" />
      <ul>
        {rows.map((row) => (
          <li key={row.name}><div><strong>{row.name}</strong><small>{row.detail}</small></div><SourcePill status={row.status} /></li>
        ))}
      </ul>
      <p className="wlt-note"><CircleAlert size={13} aria-hidden="true" />“None found” means the provider answered with nothing. “Unavailable” means it could not be read, which is never shown as zero. Quantities only: there is no verified price source, so no fiat value is shown.</p>
      <Link to="/activity" className="wlt-link wlt-link--block">Full activity history<ArrowUpRight size={12} aria-hidden="true" /></Link>
    </section>
  )
}
