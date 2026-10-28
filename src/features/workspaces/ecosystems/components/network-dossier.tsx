import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { ArtworkFrame } from '@/components/shared/artwork-frame'
import { formatCompact, formatUsdCompact } from '@/lib/format'
import type { AtlasEntry } from '@/features/workspaces/ecosystems/atlas-data'

/** Details panel for the focused network, or catalogue-wide totals when none is focused. */
export function NetworkDossier({ atlas, entry }: { atlas: AtlasEntry[]; entry?: AtlasEntry }) {
  if (!entry) {
    const totals = {
      projects: atlas.reduce((s, a) => s + a.projects.length, 0),
      collections: atlas.reduce((s, a) => s + a.collections.length, 0),
      tokens: atlas.reduce((s, a) => s + a.tokens.length, 0),
    }
    const busiest = [...atlas].sort((a, b) => b.activity - a.activity)[0]
    return (
      <aside className="nxe-dossier" aria-label="Catalogue overview">
        <p className="nx-eyebrow">Catalogue overview</p>
        <h2 className="nxe-dossier__title">{atlas.length} networks</h2>
        <p className="nxe-dossier__lede">Select a node on the atlas to focus a network and see its projects, collections and tokens.</p>
        <dl className="nxe-stats">
          <div><dt>Projects</dt><dd>{totals.projects}</dd></div>
          <div><dt>Collections</dt><dd>{totals.collections}</dd></div>
          <div><dt>Tokens</dt><dd>{totals.tokens}</dd></div>
        </dl>
        {busiest ? <p className="nxe-dossier__foot">Most linked network: <b>{busiest.network.name}</b> ({busiest.activity} catalogue entries)</p> : null}
      </aside>
    )
  }

  const { network } = entry
  const topTokens = [...entry.tokens].sort((a, b) => b.marketCap - a.marketCap).slice(0, 3)
  const topCollections = [...entry.collections].sort((a, b) => b.volume24h - a.volume24h).slice(0, 4)

  return (
    <aside className="nxe-dossier is-focused" style={{ ['--eco-accent' as string]: network.color }} aria-label={`${network.name} details`}>
      <span aria-hidden className="nxe-dossier__motif" />
      <p className="nx-eyebrow">{network.layer ? `${network.layer} network` : 'Network'}{network.chainId ? ` · chain ${network.chainId}` : ''}</p>
      <h2 className="nxe-dossier__title">{network.name} <span>{network.nativeSymbol}</span></h2>
      {network.summary ? <p className="nxe-dossier__lede">{network.summary}</p> : null}

      <dl className="nxe-stats">
        <div><dt>Projects</dt><dd>{entry.projects.length}</dd></div>
        <div><dt>Collections</dt><dd>{entry.collections.length}</dd></div>
        <div><dt>Tokens</dt><dd>{entry.tokens.length}</dd></div>
        <div><dt>Token cap</dt><dd>{entry.cap ? formatUsdCompact(entry.cap) : '—'}</dd></div>
        <div><dt>Coll. 24h vol</dt><dd>{entry.volume ? formatCompact(entry.volume) : '—'}</dd></div>
      </dl>

      {topTokens.length ? (
        <div className="nxe-block">
          <p className="nx-eyebrow">Largest tokens</p>
          <ul className="nxe-tokens">
            {topTokens.map((t) => (
              <li key={t.id}><Link to={`/tokens/${t.id}`}><b>{t.ticker}</b><span>{formatUsdCompact(t.marketCap)}</span></Link></li>
            ))}
          </ul>
        </div>
      ) : null}

      {topCollections.length ? (
        <div className="nxe-block">
          <p className="nx-eyebrow">Top collections</p>
          <ul className="nxe-colls">
            {topCollections.map((c) => (
              <li key={c.id}>
                <Link to={`/collections/${c.slug}`} title={c.name}>
                  <ArtworkFrame src={c.cover} alt={c.name} fallbackLabel={c.name.slice(0, 2)} shade="none" parallax={false} sheen={false} className="nxe-colls__thumb" />
                  <span>{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="nxe-links">
        {entry.collections.length ? <Link to={`/collections?network=${network.id}`}>All {network.shortName} collections <ArrowUpRight className="size-3.5" /></Link> : null}
        {network.docsUrl ? <a href={network.docsUrl} target="_blank" rel="noopener noreferrer">Docs <ArrowUpRight className="size-3.5" /></a> : null}
        {network.explorerUrl ? <a href={network.explorerUrl} target="_blank" rel="noopener noreferrer">Explorer <ArrowUpRight className="size-3.5" /></a> : null}
      </div>
    </aside>
  )
}
