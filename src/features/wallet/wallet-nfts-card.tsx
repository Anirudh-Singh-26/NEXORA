import { useMemo, useState } from 'react'
import { CircleAlert, ExternalLink, Image as ImageIcon, ImageOff, LoaderCircle, SearchX } from 'lucide-react'
import { useWalletNfts, type NftsError } from '@/hooks/use-wallet-nfts'
import { openSeaAssetUrl } from '@/lib/wallet-nfts/chains'
import type { NftTarget, WalletNft } from '@/lib/wallet-nfts/wallet-nfts'
import { useWallet } from '@/features/wallet-provider'
import { RefreshButton, SearchField, SectionHead, SourcePill, StateBlock } from '@/features/wallet/wallet-ui'

function shortId(tokenId: string) {
  return tokenId.length > 10 ? `${tokenId.slice(0, 5)}…${tokenId.slice(-4)}` : tokenId
}

/**
 * NFT artwork is provider/minter-supplied: an https image in a plain <img>. The frame keeps a fixed square ratio, so
 * loading, missing and broken images never shift the layout. A missing or broken image shows a neutral tile.
 */
function NftArt({ image, label }: { image: string | null; label: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const show = image && state !== 'failed'
  return (
    <div className={`wlt-nft__art ${show && state === 'loading' ? 'is-loading' : ''}`}>
      {show
        ? <img
            src={image} alt={label} loading="lazy" decoding="async" referrerPolicy="no-referrer"
            ref={(node) => { if (node?.complete && node.naturalWidth > 0 && state === 'loading') setState('ready') }}
            onLoad={() => setState('ready')} onError={() => setState('failed')}
          />
        : <div className="wlt-nft__none" role="img" aria-label={`${label} (no preview available)`}><ImageOff size={22} aria-hidden="true" /><span>No preview</span></div>}
    </div>
  )
}

export function NftCard({ nft, chainId }: { nft: WalletNft; chainId: number }) {
  const title = nft.name ?? `Token #${shortId(nft.tokenId)}`
  const url = openSeaAssetUrl(chainId, nft.contract, nft.tokenId)
  return (
    <li className="wlt-nft">
      <NftArt image={nft.image} label={title} />
      <div className="wlt-nft__meta">
        <strong title={title}>{title}</strong>
        {nft.collectionName ? <span className="wlt-nft__collection" title={nft.collectionName}>{nft.collectionName}</span> : null}
        <span className="wlt-nft__foot">
          <span title={`Token ID ${nft.tokenId}`}>#{shortId(nft.tokenId)}{nft.tokenType === 'ERC1155' && nft.balance ? ` × ${nft.balance}` : ''}</span>
          {url && <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`View ${title} on OpenSea`}>OpenSea <ExternalLink size={11} aria-hidden="true" /></a>}
        </span>
      </div>
    </li>
  )
}

export interface WalletNftsViewProps {
  target: NftTarget
  chainName: string | null
  /** A Solana account is connected: its NFTs are not supported yet (said explicitly, never simulated). */
  solanaConnected: boolean
  nfts: WalletNft[]
  nextPageKey: string | null
  hiddenSpam: number
  loading: boolean
  loadingMore: boolean
  loaded: boolean
  error: NftsError | null
  moreError: NftsError | null
  onRefresh: () => void
  onLoadMore: () => void
}

/** Presentational: every state (disconnected, loading, error, empty, unsupported, loaded) renders from props alone. */
export function WalletNftsView(props: WalletNftsViewProps) {
  const { target, chainName, solanaConnected, nfts, nextPageKey, hiddenSpam, loading, loadingMore, loaded, error, moreError, onRefresh, onLoadMore } = props
  const ready = target.kind === 'ready'
  const solanaOnly = solanaConnected && target.kind === 'no-wallet'
  const [query, setQuery] = useState('')
  const [collection, setCollection] = useState('')
  const shelves = useMemo(() => {
    const byName = new Map<string, { name: string; count: number; covers: string[] }>()
    for (const nft of nfts) {
      if (!nft.collectionName) continue
      const shelf = byName.get(nft.collectionName) ?? { name: nft.collectionName, count: 0, covers: [] }
      shelf.count += 1
      if (nft.image && shelf.covers.length < 3) shelf.covers.push(nft.image)
      byName.set(nft.collectionName, shelf)
    }
    return [...byName.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [nfts])
  const collections = useMemo(() => shelves.map((shelf) => shelf.name), [shelves])
  const activeCollection = collections.includes(collection) ? collection : ''
  const needle = query.trim().toLowerCase()
  const visible = useMemo(
    () => nfts.filter((nft) => (!activeCollection || nft.collectionName === activeCollection) && (!needle || [nft.name, nft.collectionName, nft.tokenId].some((field) => field?.toLowerCase().includes(needle)))),
    [nfts, activeCollection, needle],
  )
  const filtering = Boolean(needle || activeCollection)
  const status = solanaOnly ? 'unsupported' : !ready ? 'idle' : error && !loaded ? 'unavailable' : loaded ? (error ? 'stale' : nfts.length === 0 ? 'empty' : 'live') : 'loading'
  const pillLabel = ready && loaded && !error ? (nfts.length === 0 ? 'None found' : `${nfts.length}${nextPageKey ? '+' : ''} found`) : undefined
  const clearFilters = () => { setQuery(''); setCollection('') }

  return (
    <section className="wlt-section wlt-section--nfts" aria-label="NFTs owned by this wallet">
      <SectionHead
        label={ready && loaded && nfts.length > 0 ? `${collections.length} collection${collections.length === 1 ? '' : 's'}` : undefined}
        title={chainName && ready ? `${chainName} NFTs` : 'Wallet NFTs'}
        aside={<div className="wlt-head-tools"><SourcePill status={status} label={pillLabel} />{ready && <RefreshButton onClick={onRefresh} busy={loading} label="Refresh NFTs" />}</div>}
      />

      <div aria-live="polite">
        {solanaOnly && <StateBlock tone="info" icon={<ImageIcon size={20} />} title="Solana NFTs are not supported yet">NEXORA can list NFTs for Ethereum-compatible wallets. Solana NFT ownership needs a separate data source that has not been added, so nothing is shown here rather than an incomplete list.</StateBlock>}
        {!solanaOnly && target.kind === 'no-wallet' && <StateBlock tone="info" icon={<ImageIcon size={20} />} title="No wallet connected">Connect an Ethereum-compatible wallet to list the NFTs it owns. Reading holdings needs only your public address.</StateBlock>}
        {target.kind === 'invalid-address' && <StateBlock tone="error" icon={<CircleAlert size={20} />} title="Address unreadable">The wallet returned an address NEXORA cannot use. Reconnect and try again.</StateBlock>}
        {target.kind === 'unknown-network' && <StateBlock tone="info" icon={<CircleAlert size={20} />} title="Network unknown">The active network could not be read from your wallet, so no NFTs were requested.</StateBlock>}
        {target.kind === 'unsupported-network' && <StateBlock tone="info" icon={<CircleAlert size={20} />} title={`NFTs unavailable on this network (chain ${target.chainId})`}>NEXORA&apos;s NFT data provider is not set up for this network. Switch networks in your wallet; NEXORA will not switch for you.</StateBlock>}

        {ready && loading && !loaded && (
          <ul className="wlt-nft-grid" role="status" aria-label="Loading NFTs">
            {[0, 1, 2, 3].map((item) => <li key={item} className="wlt-nft"><div className="wlt-nft__art is-loading" /><div className="wlt-nft__meta"><span className="wlt-skel wlt-skel--line" /><span className="wlt-skel wlt-skel--line short" /></div></li>)}
          </ul>
        )}

        {ready && error && (
          <StateBlock
            tone="error" icon={<CircleAlert size={20} />} title={loaded ? 'Refresh failed' : 'NFTs could not be loaded'}
            action={error.retryable ? <button type="button" className="wlt-btn wlt-btn--sm" onClick={onRefresh}>Retry</button> : undefined}
          >
            {error.message}{loaded ? ' Showing the last loaded list.' : ' This means the data could not be read, not that the wallet owns no NFTs.'}
          </StateBlock>
        )}

        {ready && loaded && nfts.length === 0 && !error && (
          <StateBlock icon={<ImageIcon size={20} />} title="No NFTs found">The data provider returned no NFTs for this address on {chainName ?? 'this network'}.{hiddenSpam > 0 ? ` ${hiddenSpam} spam-flagged item${hiddenSpam === 1 ? ' was' : 's were'} hidden.` : ''} NFTs this address owns appear here as artwork with their collection and token ID, and NFTs on other networks appear when you switch networks in your wallet.</StateBlock>
        )}

        {ready && nfts.length > 0 && (
          <>
            {collections.length > 1 && (
              <div className="wlt-shelves" role="group" aria-label="Filter by collection">
                <button type="button" className="wlt-shelf is-all" aria-pressed={!activeCollection} onClick={() => setCollection('')}>
                  <span className="wlt-shelf__name">All collections</span>
                  <span className="wlt-shelf__count">{nfts.length}{nextPageKey ? '+' : ''} NFTs · {collections.length} collections</span>
                </button>
                {shelves.map((shelf) => (
                  <button key={shelf.name} type="button" className="wlt-shelf" aria-pressed={activeCollection === shelf.name} onClick={() => setCollection(activeCollection === shelf.name ? '' : shelf.name)}>
                    <span className="wlt-shelf__fan" aria-hidden="true">
                      {shelf.covers.length > 0
                        ? shelf.covers.map((src, index) => <img key={src + index} src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />)
                        : <i />}
                    </span>
                    <span className="wlt-shelf__name" title={shelf.name}>{shelf.name}</span>
                    <span className="wlt-shelf__count">{shelf.count} loaded</span>
                  </button>
                ))}
              </div>
            )}
            {(nfts.length > 4 || collections.length > 1) && (
              <div className="wlt-toolbar">
                <SearchField value={query} onChange={setQuery} label="Search NFTs" placeholder="Search name, collection or ID" />
                <span className="wlt-toolbar__count">{filtering ? `${visible.length} of ${nfts.length} loaded` : `${nfts.length}${nextPageKey ? '+' : ''} NFTs`}</span>
              </div>
            )}
            {visible.length > 0
              ? <ul className="wlt-nft-grid" aria-label="NFT holdings">{visible.map((nft) => <NftCard key={`${nft.contract}:${nft.tokenId}`} nft={nft} chainId={target.chainId} />)}</ul>
              : <StateBlock icon={<SearchX size={20} />} title="No loaded NFTs match" action={<button type="button" className="wlt-btn wlt-btn--sm" onClick={clearFilters}>Clear filters</button>}>{nextPageKey ? 'Only NFTs loaded so far are searched. Load more NFTs to widen the search.' : 'Try a different search or collection.'}</StateBlock>}
          </>
        )}
        {ready && loaded && nfts.length > 0 && hiddenSpam > 0 && <p className="wlt-footnote">{hiddenSpam} spam-flagged item{hiddenSpam === 1 ? '' : 's'} hidden.</p>}

        {ready && moreError && <StateBlock tone="error" icon={<CircleAlert size={20} />} title="More NFTs could not be loaded">{moreError.message}</StateBlock>}
        {ready && nextPageKey && (
          <button type="button" className="wlt-btn wlt-btn--block" onClick={onLoadMore} disabled={loadingMore || loading}>
            {loadingMore ? <><LoaderCircle size={15} className="wlt-spin" aria-hidden="true" />Loading…</> : 'Load more NFTs'}
          </button>
        )}
      </div>
      <p className="wlt-footnote"><CircleAlert size={13} aria-hidden="true" />Holdings are read from Alchemy&apos;s NFT API by your public address, for the network your wallet is on. Names and images are set by whoever minted each NFT and may be inaccurate. {solanaConnected && !solanaOnly ? 'A connected Solana account is not included: Solana NFTs are not supported yet.' : ''}</p>
    </section>
  )
}

/** Connected-wallet NFT section. Kept for compatibility; the Wallets page now shares one hook instance via WalletNftsView. */
export function WalletNftsCard() {
  const wallet = useWallet()
  const nfts = useWalletNfts(wallet.evmAddress, wallet.chainId)
  return (
    <WalletNftsView
      target={nfts.target}
      chainName={wallet.network?.shortName ?? null}
      solanaConnected={wallet.solanaAddress !== null}
      nfts={nfts.nfts}
      nextPageKey={nfts.nextPageKey}
      hiddenSpam={nfts.hiddenSpam}
      loading={nfts.loading}
      loadingMore={nfts.loadingMore}
      loaded={nfts.loaded}
      error={nfts.error}
      moreError={nfts.moreError}
      onRefresh={nfts.refresh}
      onLoadMore={nfts.loadMore}
    />
  )
}
