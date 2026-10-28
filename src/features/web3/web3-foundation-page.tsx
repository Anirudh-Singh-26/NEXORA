import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, CircleHelp, Copy, Database, ExternalLink, Fingerprint, Globe2, LoaderCircle, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWallet } from '@/features/wallet-provider'
import { ChainDataStatus, ProvenanceNote } from '@/components/shared/chain-data-state'
import { useChainSnapshot } from '@/hooks/use-chain-snapshot'
import { blockchain } from '@/lib/blockchain'

const CHAINS = blockchain.listChains()
const IPFS_GATEWAYS = ['https://ipfs.io/ipfs/', 'https://dweb.link/ipfs/']
const CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{20,})$/i

function formatTime(timestamp?: number) {
  return timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Not checked yet'
}

export function Web3FoundationPage() {
  const wallet = useWallet()
  const [chainId, setChainId] = useState(1)
    const [cid, setCid] = useState('')
  const [gatewayIndex, setGatewayIndex] = useState(0)
  const [ipfsStatus, setIpfsStatus] = useState<'idle' | 'checking' | 'available' | 'error'>('idle')
  const [ipfsError, setIpfsError] = useState('')
  const [copied, setCopied] = useState(false)
  const chain = useMemo(() => CHAINS.find((item) => item.chainId === chainId) ?? CHAINS[0], [chainId])
  const validCid = CID_RE.test(cid.trim())
  const ipfsUrl = validCid ? `${IPFS_GATEWAYS[gatewayIndex]}${cid.trim()}` : ''

  const snapshot = useChainSnapshot(chain.chainId)
  const result = snapshot.result
  const ok = result?.status === 'ok' ? result : null
  const probeLabel = snapshot.loading ? 'Checking…' : ok ? (ok.provenance.stale ? 'Stale data' : ok.provenance.fromCache ? 'Cached data' : 'Provider responded') : result ? 'Provider unavailable' : 'Not checked'
  const probeTone = snapshot.loading ? 'border-line text-mute' : ok ? (ok.provenance.stale ? 'border-loss/30 text-loss' : 'border-gain/30 text-gain') : result ? 'border-loss/30 text-loss' : 'border-line text-mute'

  const checkIpfs = async () => {
    if (!validCid) return
    setIpfsStatus('checking'); setIpfsError('')
    try {
      const response = await fetch(ipfsUrl, { method: 'HEAD', signal: AbortSignal.timeout(9000), cache: 'no-store' })
      if (!response.ok) throw new Error(`Gateway returned HTTP ${response.status}`)
      setIpfsStatus('available')
    } catch (error) {
      setIpfsStatus('error'); setIpfsError(error instanceof Error ? error.message : 'Gateway request failed')
    }
  }

  const copyAddress = async () => {
    if (!wallet.address || !navigator.clipboard) return
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { setCopied(false) }
  }

  return <main className="mx-auto w-full max-w-[1440px] space-y-7 px-4 py-6 md:px-7 md:py-9">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="nx-kicker">NEXORA / WEB3 FOUNDATION</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">Decentralized data workspace</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-mute">A functional integration surface for public blockchain RPC, IPFS content addressing and optional wallet identity. Public endpoints may be rate-limited; availability is checked live from your browser.</p></div>
      <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs text-mute"><span className="size-2 rounded-full bg-copper" /> Integration foundation · early access</span>
    </div>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
      <article className="nx-panel min-w-0 rounded-2xl p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl border border-line"><Globe2 size={19}/></span><div><h2 className="text-base font-semibold">Blockchain RPC health</h2><p className="mt-1 text-xs text-mute">Read-only JSON-RPC probe · no wallet signature</p></div></div><span className={`rounded-full border px-2.5 py-1 text-[11px] ${probeTone}`}>{probeLabel}</span></div>
        <label className="mt-5 block text-xs text-mute">Network<select value={chainId} onChange={(event) => setChainId(Number(event.target.value))} className="nx-field mt-2 h-11 w-full rounded-xl px-3 text-sm text-ink outline-none">{CHAINS.map((item) => <option key={item.chainId} value={item.chainId}>{item.name} · Chain {item.chainId}</option>)}</select></label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="nx-surface rounded-xl p-3"><p className="text-[10px] uppercase tracking-wider text-mute">Latest block</p><p className="mt-2 font-mono text-lg">{ok ? ok.data.blockNumber.toLocaleString() : '—'}</p></div><div className="nx-surface rounded-xl p-3"><p className="text-[10px] uppercase tracking-wider text-mute">Gas price</p><p className="mt-2 font-mono text-lg">{ok ? `${ok.data.gasPriceGwei} gwei` : '—'}</p></div><div className="nx-surface rounded-xl p-3"><p className="text-[10px] uppercase tracking-wider text-mute">Response time</p><p className="mt-2 font-mono text-lg">{ok ? (ok.provenance.latencyMs !== null ? `${ok.provenance.latencyMs} ms` : 'cached') : '—'}</p></div><div className="nx-surface rounded-xl p-3"><p className="text-[10px] uppercase tracking-wider text-mute">Last checked</p><p className="mt-2 text-sm">{formatTime(ok?.provenance.retrievedAt)}</p></div></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3"><div className="min-w-0"><p className="text-xs font-medium">Data source</p><p className="mt-1 break-all font-mono text-[11px] text-mute">{ok ? ok.provenance.source : chain.endpoints[0]?.id ?? 'none configured'}</p></div><button type="button" onClick={snapshot.refresh} disabled={snapshot.loading} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs disabled:opacity-50"><RefreshCw size={13} className={snapshot.loading ? 'animate-spin' : ''}/> Recheck</button></div>
        <ChainDataStatus loading={snapshot.loading && !ok} result={result} onRetry={snapshot.refresh} />
        {ok && <div className="mt-3 space-y-1"><ProvenanceNote provenance={ok.provenance} refreshError={ok.refreshError} /><p className="text-[11px] leading-5 text-mute">Block height and gas price were read from this single provider, whose own chain ID matched {chain.name}. Public RPC data is not independently verified.</p></div>}
      </article>

      <article className="nx-panel min-w-0 rounded-2xl p-5 md:p-6">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl border border-line"><Fingerprint size={19}/></span><div><h2 className="text-base font-semibold">Hybrid identity</h2><p className="mt-1 text-xs text-mute">Web2 profile and Web3 wallet are separate</p></div></div>
        <div className="mt-5 rounded-xl border border-line p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs text-mute">Web3 wallet</span><span className={`text-[11px] ${wallet.address ? 'text-gain' : 'text-mute'}`}>{wallet.address ? 'Connected' : 'Optional / disconnected'}</span></div><p className="mt-2 break-all font-mono text-xs">{wallet.address ?? 'No wallet address exposed to this session'}</p>{wallet.address ? <button onClick={() => void copyAddress()} type="button" className="mt-3 inline-flex items-center gap-2 text-xs text-mute hover:text-ink"><Copy size={13}/>{copied ? 'Copied address' : 'Copy public address'}</button> : <Link to="/wallet" className="mt-3 inline-flex items-center gap-2 text-xs text-ink underline underline-offset-4"><Wallet size={13}/> Open wallet connection</Link>}</div>
        <div className="mt-3 rounded-xl border border-line p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs text-mute">Web2 profile</span><span className="text-[11px] text-copper">Local demo profile</span></div><p className="mt-2 text-sm">Browser-local profile state</p><p className="mt-1 text-xs leading-5 text-mute">This is not server authentication. Do not treat local browser storage as a secure account or identity proof.</p><Link to="/profile" className="mt-3 inline-flex items-center gap-2 text-xs text-ink underline underline-offset-4">Open profile settings <ExternalLink size={12}/></Link></div>
        <p className="mt-4 flex gap-2 text-xs leading-5 text-mute"><ShieldCheck size={15} className="mt-0.5 shrink-0"/> Wallet connection is optional. This page does not request signatures or submit transactions.</p>
      </article>
    </section>

    <section className="nx-panel rounded-2xl p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl border border-line"><Database size={19}/></span><div><h2 className="text-base font-semibold">IPFS content resolver</h2><p className="mt-1 text-xs text-mute">Validate a CID and test a public gateway before opening content.</p></div></div><span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-mute">Read-only</span></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]"><div><label className="block text-xs text-mute">Content Identifier (CID)<input value={cid} onChange={(event) => { setCid(event.target.value.trim()); setIpfsStatus('idle'); setIpfsError('') }} placeholder="Paste a CIDv0 (Qm…) or CIDv1 (bafy…)" className="nx-field mt-2 h-11 w-full rounded-xl px-3 font-mono text-sm text-ink outline-none" /></label><p className="mt-2 text-[11px] text-mute">CID format check is local; gateway availability is only known after the request completes.</p></div><label className="block text-xs text-mute">Gateway<select value={gatewayIndex} onChange={(event) => { setGatewayIndex(Number(event.target.value)); setIpfsStatus('idle') }} className="nx-field mt-2 h-11 w-full rounded-xl px-3 text-sm text-ink outline-none"><option value={0}>ipfs.io</option><option value={1}>dweb.link</option></select></label></div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={!validCid || ipfsStatus === 'checking'} onClick={() => void checkIpfs()} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40">{ipfsStatus === 'checking' ? <LoaderCircle size={15} className="animate-spin"/> : <Activity size={15}/>} Test gateway</button><span className={`text-xs ${!cid ? 'text-mute' : validCid ? 'text-gain' : 'text-loss'}`}>{!cid ? 'Waiting for CID' : validCid ? 'CID format looks valid' : 'CID format not recognized'}</span>{validCid && <a href={ipfsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-ink underline underline-offset-4">Open content <ExternalLink size={12}/></a>}</div>
      {ipfsStatus === 'available' && <p role="status" className="mt-3 flex gap-2 text-xs text-gain"><CheckCircle2 size={15}/> Gateway responded successfully to a HEAD request. This does not validate the content's trustworthiness.</p>}
      {ipfsStatus === 'error' && <p role="alert" className="mt-3 flex gap-2 text-xs leading-5 text-loss"><AlertTriangle size={15}/>{ipfsError}. Try the alternate gateway. Gateway failures can be caused by CORS, rate limits or unavailable content.</p>}
    </section>

    <section className="grid gap-3 md:grid-cols-3"><div className="nx-surface rounded-xl p-4"><p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 size={15}/> Implemented in this batch</p><p className="mt-2 text-xs leading-5 text-mute">Shared read-only RPC layer (block height, gas price, provider failover, caching, provenance), manual refresh, CID format validation and gateway reachability checks.</p></div><div className="nx-surface rounded-xl p-4"><p className="flex items-center gap-2 text-sm font-medium"><CircleHelp size={15}/> Not yet implemented</p><p className="mt-2 text-xs leading-5 text-mute">Indexed NFT/token data, server-backed Web2 authentication and cross-device account persistence.</p></div><div className="nx-surface rounded-xl p-4"><p className="flex items-center gap-2 text-sm font-medium"><AlertTriangle size={15}/> Data-source honesty</p><p className="mt-2 text-xs leading-5 text-mute">Existing market catalog figures elsewhere in NEXORA remain sample data unless explicitly replaced with a verified live source.</p></div></section>
  </main>
}
