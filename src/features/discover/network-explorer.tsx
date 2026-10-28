import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { ChangeValue } from '@/components/shared/change-value'
import { SectionHeader } from '@/components/shared/section-header'
import { TokenGlyph } from '@/components/shared/token-glyph'
import { artworkFallbackFor, catalog } from '@/data/catalog'
import type { Network, NetworkId } from '@/data/types'
import { formatCompact, formatFloor, formatUsd } from '@/lib/format'
import { DxTabList } from './dx-tabs'
import { dxPanelId, dxTabId } from './dx-tabs-ids'
import { ease, rise, stagger } from '@/lib/motion'

const PREFIX = 'nx-network'

/** Everything the explorer shows for a network, derived from the catalog. */
function describe(network: Network) {
  const collections = catalog.collections.filter((c) => c.networkId === network.id).sort((a, b) => b.owners - a.owners)
  const tokens = catalog.tokens.filter((t) => t.networkId === network.id || t.supportedNetworkIds?.includes(network.id))
  const native = catalog.tokens.find((t) => t.id === network.nativeTokenId)
  return {
    network,
    collections,
    tokens,
    native,
    items: collections.reduce((sum, c) => sum + c.items, 0),
    holders: collections.reduce((sum, c) => sum + c.owners, 0),
  }
}

/** Multi-chain explorer: pick a network, see its identity, native token and catalog footprint. */
export function NetworkExplorer() {
  const entries = useMemo(() => catalog.networks.map(describe), [])
  const [activeId, setActiveId] = useState<NetworkId>(entries[0]?.network.id ?? 'ethereum')
  const active = entries.find((e) => e.network.id === activeId) ?? entries[0]
  if (!active) return null

  const { network, collections, tokens, native } = active

  return (
    <motion.section
      className="nx-dx nx-dx-net"
      variants={stagger(0.05)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.08 }}
      aria-label="Multi-chain explorer"
    >
      <motion.div variants={rise}>
        <SectionHeader
          kicker="Multi-chain"
          title="Explore by network"
          description={`${catalog.networks.length} networks, one catalog. Select a chain to see what lives on it.`}
          href="/ecosystems"
        />
      </motion.div>

      <motion.div variants={rise} className="nx-dx-net__layout">
        <DxTabList
          label="Networks"
          prefix={PREFIX}
          value={network.id}
          onChange={setActiveId}
          orientation="vertical"
          className="nx-dx-net__list"
          tabClassName="nx-dx-net__tab"
          tabs={entries.map((e) => ({
            value: e.network.id,
            ariaLabel: `${e.network.name}: ${e.collections.length} collections, ${e.tokens.length} tokens`,
            label: (
              <>
                <span aria-hidden className="nx-dx-net__dot" style={{ background: e.network.color }} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="nx-dx-net__tab-name">{e.network.name}</span>
                  <span className="nx-dx-net__tab-meta">{e.collections.length} {e.collections.length === 1 ? 'collection' : 'collections'} · {e.tokens.length} {e.tokens.length === 1 ? 'token' : 'tokens'}</span>
                </span>
                <span className="nx-dx-net__layer">{e.network.layer}</span>
              </>
            ),
          }))}
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={network.id}
            id={dxPanelId(PREFIX)}
            role="tabpanel"
            aria-labelledby={dxTabId(PREFIX, network.id)}
            className="nx-dx-net__panel"
            style={{ ['--dx-accent' as string]: network.color }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <div className="nx-dx-net__head">
              <div className="min-w-0">
                <p className="nx-eyebrow">{network.layer === 'L2' ? 'Layer 2' : 'Layer 1'}{network.chainId ? ` · Chain ID ${network.chainId}` : ''}</p>
                <h3 className="nx-dx-net__name">{network.name}</h3>
                <p className="nx-dx-net__summary">{network.summary}</p>
              </div>
              {native ? (
                <Link to={`/tokens/${native.id}`} className="nx-dx-net__native group" aria-label={`Native token ${native.name}, ${formatUsd(native.price)}`}>
                  <TokenGlyph token={native} className="size-10" />
                  <span className="min-w-0">
                    <span className="nx-eyebrow block">Native · {network.nativeSymbol}</span>
                    <span className="mt-0.5 flex items-baseline gap-2">
                      <span className="font-mono text-[14px] tabular-nums">{formatUsd(native.price)}</span>
                      <ChangeValue value={native.change24h} />
                    </span>
                  </span>
                </Link>
              ) : null}
            </div>

            <dl className="nx-dx-net__stats">
              <div><dt>Collections</dt><dd>{collections.length}</dd></div>
              <div><dt>Tokens</dt><dd>{tokens.length}</dd></div>
              <div><dt>Items</dt><dd>{formatCompact(active.items)}</dd></div>
              <div><dt>Holders</dt><dd>{formatCompact(active.holders)}</dd></div>
            </dl>

            <div className="nx-dx-net__cols">
              <div>
                <p className="nx-eyebrow">Collections</p>
                {collections.length ? (
                  <ul className="nx-dx-net__collections">
                    {collections.slice(0, 3).map((c) => (
                      <li key={c.id}>
                        <Link to={`/collections/${c.slug}`} className="nx-dx-net__col group">
                          <span className="nx-dx-net__col-art">
                            <ArtworkFrame src={c.cover} fallbackSrc={artworkFallbackFor(c.id)} alt="" fallbackLabel="" shade="none" parallax={false} sheen={false} className="absolute inset-0" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="nx-dx-net__col-name">{c.name}</span>
                            <span className="nx-dx-net__col-meta">Floor {formatFloor(c.floor, c.floorSymbol)}</span>
                          </span>
                          <ArrowUpRight aria-hidden className="size-3.5 shrink-0 text-mute transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:text-ink" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="nx-dx-net__empty">No sample collections on {network.name} in this demo catalog yet.</p>
                )}
              </div>

              <div>
                <p className="nx-eyebrow">Tokens</p>
                {tokens.length ? (
                  <ul className="nx-dx-net__tokens">
                    {tokens.slice(0, 6).map((t) => (
                      <li key={t.id}>
                        <Link to={`/tokens/${t.id}`} className="nx-dx-net__token" aria-label={`${t.name} (${t.ticker})`}>
                          <TokenGlyph token={t} className="size-5 rounded-md" />
                          {t.ticker}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="nx-dx-net__empty">No tokens mapped to this network.</p>
                )}
              </div>
            </div>

            <div className="nx-dx-net__actions">
              {collections.length ? (
                <Link to={`/collections?network=${network.id}`} className="nx-dx-cta group">
                  Browse {collections.length} {collections.length === 1 ? 'collection' : 'collections'}
                  <ArrowRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              ) : (
                <Link to="/collections" className="nx-dx-cta group">
                  Browse all collections
                  <ArrowRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              )}
              <Link to="/ecosystems" className="nx-dx-link group">
                Network atlas
                <ArrowUpRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5" />
              </Link>
              {network.docsUrl ? (
                <a href={network.docsUrl} target="_blank" rel="noopener noreferrer" className="nx-dx-link group">
                  Docs
                  <ArrowUpRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-0.5" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.section>
  )
}
