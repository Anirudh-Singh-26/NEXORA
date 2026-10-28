import { useMemo, useState } from 'react'
import { Check, CircleAlert, Copy, ExternalLink, Layers, LoaderCircle, SearchX } from 'lucide-react'
import { useWalletTokens, type TokensError } from '@/hooks/use-wallet-tokens'
import { blockchain } from '@/lib/blockchain'
import { formatTokenBalance, type TokenTarget, type WalletToken } from '@/lib/wallet-tokens/wallet-tokens'
import { useWallet } from '@/features/wallet-provider'
import { RefreshButton, RowSkeletons, SearchField, SectionHead, SourcePill, StateBlock } from '@/features/wallet/wallet-ui'
import { identityGradient } from '@/features/wallet/wallet-utils'

function shortContract(contract: string) {
  return `${contract.slice(0, 6)}…${contract.slice(-4)}`
}

/** Token logo with a safe fallback. Logos are provider-supplied https URLs; a broken one falls back to the symbol. */
function TokenLogo({ logo, symbol, seed }: { logo: string | null; symbol: string | null; seed: string }) {
  const [failed, setFailed] = useState(false)
  const showImage = logo && !failed
  return (
    <span className="wlt-logo" aria-hidden="true" style={showImage ? undefined : { background: identityGradient(seed) }}>
      {showImage
        ? <img src={logo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        : (symbol ?? '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

export function TokenRow({ token, explorerUrl, networkName }: { token: WalletToken; explorerUrl: string | null; networkName?: string | null }) {
  const amount = formatTokenBalance(token.rawBalance, token.decimals)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(token.contract)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <li className="wlt-asset">
      <TokenLogo logo={token.logo} symbol={token.symbol} seed={token.contract} />
      <div className="wlt-asset__main">
        <strong title={token.name ?? undefined}>{token.name ?? 'Unnamed token'}{token.symbol ? <small>{token.symbol}</small> : null}</strong>
        <span className="wlt-asset__sub">
          {networkName ? <>{networkName}<i aria-hidden="true">·</i></> : null}
          {explorerUrl
            ? <a href={`${explorerUrl}/token/${token.contract}`} target="_blank" rel="noreferrer" aria-label={`View ${token.name ?? 'token'} contract on the block explorer`}>{shortContract(token.contract)} <ExternalLink size={11} aria-hidden="true" /></a>
            : <code>{shortContract(token.contract)}</code>}
          <button
            type="button"
            className="wlt-token-copy-btn"
            onClick={handleCopy}
            title={copied ? 'Contract address copied!' : 'Copy contract address'}
            aria-label={`Copy contract address for ${token.name ?? token.symbol ?? 'token'}`}
          >
            {copied ? <Check size={11} className="text-gain" aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
          </button>
        </span>
      </div>
      <div className="wlt-asset__amount">
        {amount !== null
          ? <><b>{amount}</b>{token.symbol ? <small>{token.symbol}</small> : null}</>
          : <span title={`Raw units: ${token.rawBalance}`}>Balance unavailable<small className="block">decimals unknown</small></span>}
      </div>
    </li>
  )
}

export interface WalletTokensViewProps {
  target: TokenTarget
  chainName: string | null
  explorerUrl: string | null
  tokens: WalletToken[]
  nextPageKey: string | null
  metadataPartial: boolean
  loading: boolean
  loadingMore: boolean
  loaded: boolean
  error: TokensError | null
  moreError: TokensError | null
  onRefresh: () => void
  onLoadMore: () => void
}

/** Presentational: everything it shows comes from props, so every state can be rendered without a wallet or network. */
export function WalletTokensView(props: WalletTokensViewProps) {
  const { target, chainName, explorerUrl, tokens, nextPageKey, metadataPartial, loading, loadingMore, loaded, error, moreError, onRefresh, onLoadMore } = props
  const ready = target.kind === 'ready'
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const visible = useMemo(
    () => (needle ? tokens.filter((token) => [token.name, token.symbol, token.contract].some((field) => field?.toLowerCase().includes(needle))) : tokens),
    [tokens, needle],
  )
  const status = !ready ? 'idle' : error && !loaded ? 'unavailable' : loading && !loaded ? 'loading' : loaded ? (error ? 'stale' : tokens.length === 0 ? 'empty' : 'live') : 'loading'
  const pillLabel = ready && loaded && !error ? (tokens.length === 0 ? 'None found' : `${tokens.length}${nextPageKey ? '+' : ''} found`) : undefined

  return (
    <section className="wlt-section wlt-section--tokens" aria-label="ERC-20 token balances">
      <SectionHead
        label={ready && loaded && tokens.length > 0 ? 'ERC-20' : undefined}
        title={chainName ? `${chainName} token balances` : 'Token balances'}
        aside={<div className="wlt-head-tools">{ready && <SourcePill status={status} label={pillLabel} />}{ready && <RefreshButton onClick={onRefresh} busy={loading} label="Refresh token balances" />}</div>}
      />

      <div aria-live="polite">
        {target.kind === 'no-wallet' && <StateBlock tone="info" icon={<Layers size={20} />} title="No wallet connected">Connect an Ethereum-compatible wallet to list the ERC-20 tokens it holds. Reading balances needs only your public address.</StateBlock>}
        {target.kind === 'invalid-address' && <StateBlock tone="error" icon={<CircleAlert size={20} />} title="Address unreadable">The wallet returned an address NEXORA cannot use. Reconnect and try again.</StateBlock>}
        {target.kind === 'unknown-network' && <StateBlock tone="info" icon={<CircleAlert size={20} />} title="Network unknown">The active network could not be read from your wallet, so no token balances were requested.</StateBlock>}
        {target.kind === 'unsupported-network' && <StateBlock tone="info" icon={<CircleAlert size={20} />} title={`Token balances unavailable (chain ${target.chainId})`}>The token data provider is not configured for this network. Switch networks in your wallet; NEXORA will not switch for you.</StateBlock>}

        {ready && loading && !loaded && <RowSkeletons label="Loading token balances" />}

        {ready && error && (
          <StateBlock
            tone="error" icon={<CircleAlert size={20} />} title={loaded ? 'Refresh failed' : 'Token balances could not be loaded'}
            action={error.retryable ? <button type="button" className="wlt-btn wlt-btn--sm" onClick={onRefresh}>Retry</button> : undefined}
          >
            {error.message}{loaded ? ' Showing the last loaded list.' : ' This means the data could not be read, not that the wallet holds no tokens.'}
          </StateBlock>
        )}

        {ready && loaded && tokens.length === 0 && !error && (
          <StateBlock icon={<Layers size={20} />} title="No tokens found on this network">The data provider returned no non-zero ERC-20 balances for this address on {chainName ?? 'this network'}. Your native balance is shown at the top of this page, and tokens on other networks appear when you switch networks in your wallet.</StateBlock>
        )}

        {ready && tokens.length > 0 && (
          <>
            {tokens.length > 2 && (
              <div className="wlt-toolbar">
                <SearchField value={query} onChange={setQuery} label="Search tokens" placeholder="Search name, symbol or contract" />
                <span className="wlt-toolbar__count">{needle ? `${visible.length} of ${tokens.length} loaded` : `${tokens.length}${nextPageKey ? '+' : ''} tokens`}</span>
              </div>
            )}
            {visible.length > 0
              ? <ul className="wlt-ledger" aria-label="Token holdings">{visible.map((token) => <TokenRow key={token.contract} token={token} explorerUrl={explorerUrl} />)}</ul>
              : <StateBlock icon={<SearchX size={20} />} title="No loaded tokens match" action={<button type="button" className="wlt-btn wlt-btn--sm" onClick={() => setQuery('')}>Clear search</button>}>{nextPageKey ? 'Only tokens loaded so far are searched. Load more tokens to widen the search.' : 'Try a different name, symbol or contract address.'}</StateBlock>}
          </>
        )}

        {ready && moreError && <StateBlock tone="error" icon={<CircleAlert size={20} />} title="More tokens could not be loaded">{moreError.message}</StateBlock>}
        {ready && nextPageKey && (
          <button type="button" className="wlt-btn wlt-btn--block" onClick={onLoadMore} disabled={loadingMore || loading}>
            {loadingMore ? <><LoaderCircle size={15} className="wlt-spin" aria-hidden="true" />Loading…</> : 'Load more tokens'}
          </button>
        )}
      </div>

      {ready && loaded && metadataPartial && <p className="wlt-footnote"><CircleAlert size={13} aria-hidden="true" />Some token details (name, symbol, decimals, logo) could not be loaded and are shown as unavailable.</p>}
      <p className="wlt-footnote"><CircleAlert size={13} aria-hidden="true" />Token balances are provided by Alchemy’s Token API and may be incomplete; this is not a guaranteed list of every token. Anyone can create a token with any name, so lookalike or unsolicited tokens may appear: NEXORA does not verify them. These are token amounts only, with no prices or portfolio value.</p>
    </section>
  )
}

/** Connected-wallet ERC-20 section. Kept for compatibility; the Wallets page now shares one hook instance via WalletTokensView. */
export function WalletTokensCard() {
  const wallet = useWallet()
  const tokens = useWalletTokens(wallet.evmAddress, wallet.chainId)
  const chain = tokens.target.kind === 'ready' ? blockchain.resolveChain(tokens.target.chainId) : null
  return (
    <WalletTokensView
      target={tokens.target}
      chainName={chain?.shortName ?? null}
      explorerUrl={chain?.explorerUrl ?? null}
      tokens={tokens.tokens}
      nextPageKey={tokens.nextPageKey}
      metadataPartial={tokens.metadataPartial}
      loading={tokens.loading}
      loadingMore={tokens.loadingMore}
      loaded={tokens.loaded}
      error={tokens.error}
      moreError={tokens.moreError}
      onRefresh={tokens.refresh}
      onLoadMore={tokens.loadMore}
    />
  )
}
