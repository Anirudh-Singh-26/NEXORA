import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, ClipboardPaste, X } from 'lucide-react'
import { TokenGlyph } from '@/components/shared/token-glyph'
import { motion } from 'motion/react'
import { dur, ease } from '@/lib/motion'
import { catalog } from '@/data/catalog'
import { cn } from '@/lib/utils'
import { SearchField } from '@/features/workspaces/shared/search-field'
import { CopyButton } from '@/features/workspaces/tools/tool-card'
import { ToolDirectory, ToolPanel } from '@/features/workspaces/tools/components/tool-directory'
import { matchTools, TOOLS, type ToolCategory, type ToolId } from '@/features/workspaces/tools/tools-directory'
import './tools/tools-page.css'

function ethToWei(value: string): string {
  if (!/^\d+(?:\.\d{0,18})?$/.test(value)) return '—'
  const [whole, fraction = ''] = value.split('.')
  return (BigInt(whole) * 10n ** 18n + BigInt((fraction + '0'.repeat(18)).slice(0, 18))).toString()
}

type AddressKind = 'empty' | 'evm' | 'solana' | 'invalid'


function inspectAddress(raw: string): { kind: AddressKind; message: string } {
  const value = raw.trim()
  if (!value) return { kind: 'empty', message: 'Enter an address first.' }
  if (/^0x[a-fA-F0-9]{40}$/.test(value)) return { kind: 'evm', message: 'Format looks like an EVM address. Checksum and chain ownership are not verified.' }
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return { kind: 'solana', message: 'Format resembles a Solana address. Network validity is not verified.' }
  return { kind: 'invalid', message: 'Format does not match the supported basic patterns.' }
}

/** Plain-language hint about *why* an address fails, shown while typing. */


function addressHint(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (v.startsWith('0x') || v.startsWith('0X')) {
    if (!v.startsWith('0x')) return 'Use a lowercase “0x” prefix.'
    if (v.length !== 42) return `EVM addresses are 42 characters including 0x — this has ${v.length}.`
    if (!/^0x[a-fA-F0-9]+$/.test(v)) return 'Only hexadecimal characters (0–9, a–f) are allowed after 0x.'
    return null
  }
  if (/[0OIl]/.test(v)) return 'Solana (base58) addresses never contain 0, O, I or l.'
  if (v.length < 32 || v.length > 44) return `Solana addresses are 32–44 characters — this has ${v.length}.`
  return null
}


function formatUnits(wei: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals)
  const whole = wei / base
  const frac = (wei % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return frac ? `${whole.toString()}.${frac}` : whole.toString()
}


function parseEth(raw: string): { ok: true; wei: bigint } | { ok: false; error: string | null } {
  const value = raw.trim()
  if (!value) return { ok: false, error: null }
  if (value.startsWith('-')) return { ok: false, error: 'Amount cannot be negative.' }
  if (!/^\d*\.?\d*$/.test(value) || value === '.') return { ok: false, error: 'Enter a plain decimal number (digits and one dot).' }
  const [, fraction = ''] = value.split('.')
  if (fraction.length > 18) return { ok: false, error: 'ETH supports at most 18 decimal places.' }
  const wei = ethToWei(value.startsWith('.') ? `0${value}` : value.endsWith('.') ? value.slice(0, -1) : value)
  if (wei === '—') return { ok: false, error: 'That value cannot be converted.' }
  return { ok: true, wei: BigInt(wei) }
}


/**
 * Web3 tools: a utility workbench. A searchable directory on the left opens one
 * tool at a time on the right. Every tool stays mounted (inactive ones are only
 * hidden), so inputs and results survive switching between tools.
 */
export function ToolsWorkspace() {
  const [address, setAddress] = useState('')
  const [checked, setChecked] = useState<string | null>(null)
  const [amount, setAmount] = useState('1')
  const [lookup, setLookup] = useState('')
  const [pasteError, setPasteError] = useState(false)

  const live = inspectAddress(address)
  const result = checked !== null ? inspectAddress(checked) : null
  const hint = addressHint(address)
  const eth = parseEth(amount)
  const weiText = eth.ok ? eth.wei.toString() : '—'
  const gweiText = eth.ok ? formatUnits(eth.wei, 9) : '—'
  const ethText = eth.ok ? formatUnits(eth.wei, 18) : '—'

  const q = lookup.trim().toLowerCase()
  const tokens = catalog.tokens.filter((t) => !q || `${t.ticker} ${t.name}`.toLowerCase().includes(q)).slice(0, q ? 12 : 8)
  const collections = catalog.collections.filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, q ? 8 : 4)

  const tone = { empty: 'text-mute', evm: 'text-gain', solana: 'text-gain', invalid: 'text-loss' }[live.kind]
  const chip = { empty: 'Awaiting input', evm: 'EVM format', solana: 'Solana format', invalid: 'No match' }[live.kind]

  const [find, setFind] = useState('')
  const [category, setCategory] = useState<ToolCategory | 'all'>('all')
  const [selected, setSelected] = useState<ToolId>('address')

  const matches = useMemo(() => matchTools(find, category), [find, category])
  const activeId = matches.find((t) => t.id === selected)?.id ?? matches[0]?.id
  const tool = (id: ToolId) => TOOLS.find((t) => t.id === id)!
  const reset = () => { setFind(''); setCategory('all') }

  return (
    <div className="nxu-page">
      <header className="nxu-head">
        <div>
          <p className="nx-kicker">Developer utilities</p>
          <h1 className="nxu-head__title">Web3 tools</h1>
          <p className="nxu-head__note">Small, exact utilities for addresses and units. Everything runs in your browser — no wallet, no RPC, no network request.</p>
        </div>
        <SearchField value={find} onChange={setFind} placeholder={`Find a tool (${TOOLS.length})`} label="Find a tool" className="nxu-head__search" />
      </header>

      <div className="nxu-shell">
        <aside className="nxu-side">
          <ToolDirectory tools={matches} activeId={activeId} onSelect={setSelected} category={category} onCategory={setCategory} />
          {matches.length === 0 ? (
            <div className="nxu-none">
              <p>No tools match{find.trim() ? ` “${find.trim()}”` : ''}.</p>
              <button type="button" onClick={reset}>Clear search</button>
            </div>
          ) : null}
        </aside>

        <div className="nxu-stage">
          {matches.length === 0 ? (
            <div className="nxu-stage__empty">Pick a tool from the directory once one matches.</div>
          ) : null}

          <ToolPanel tool={tool('address')} hidden={activeId !== 'address'}>
            <form onSubmit={(e) => { e.preventDefault(); setChecked(address) }}>
              <label className="nx-field flex items-center gap-2 px-3 py-0.5">
                <span className="sr-only">Public address</span>
                <input
                  className="h-11 min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-mute/70"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setChecked(null); setPasteError(false) }}
                  placeholder="Paste a public address"
                  aria-label="Public address"
                  spellCheck={false}
                  autoComplete="off"
                />
                {address ? <button type="button" onClick={() => { setAddress(''); setChecked(null) }} aria-label="Clear address" className="rounded p-1 text-mute hover:text-ink"><X className="size-3.5" /></button> : null}
                <button
                  type="button"
                  onClick={async () => { try { const text = await navigator.clipboard.readText(); setAddress(text.trim()); setChecked(null); setPasteError(false) } catch { setPasteError(true) } }}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[11px] text-mute transition-colors hover:border-copper/40 hover:text-ink"
                ><ClipboardPaste size={12} /> Paste</button>
              </label>
              {pasteError ? <p className="mt-2 text-[11.5px] text-loss" role="alert">Clipboard access was blocked — paste with Ctrl/⌘ + V instead.</p> : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                <span className={cn('inline-flex items-center gap-1.5 font-mono', tone)} aria-live="polite">
                  <span className={cn('size-1.5 rounded-full', live.kind === 'invalid' ? 'bg-loss' : live.kind === 'empty' ? 'bg-mute/50' : 'bg-gain')} />{chip}
                  {address.trim() ? <span className="text-mute">· {address.trim().length} chars</span> : null}
                </span>
                <span className="flex items-center gap-1.5 text-mute">Try
                  <button type="button" onClick={() => { setAddress('0x1111111111111111111111111111111111111111'); setChecked(null) }} className="rounded border border-line px-1.5 py-0.5 hover:border-copper/40 hover:text-ink">EVM sample</button>
                  <button type="button" onClick={() => { setAddress('11111111111111111111111111111111'); setChecked(null) }} className="rounded border border-line px-1.5 py-0.5 hover:border-copper/40 hover:text-ink">Solana sample</button>
                </span>
              </div>
              {hint && live.kind === 'invalid' ? <p className="mt-2 text-[11.5px] leading-5 text-mute">Hint: {hint}</p> : null}

              <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90">Validate format</button>
            </form>

            {result ? (
                <motion.div key={checked} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.base, ease }} className={cn('mt-4 flex items-start gap-3 rounded-xl border p-3.5 text-[13px] leading-5', result.kind === 'evm' || result.kind === 'solana' ? 'border-gain/30 bg-gain/[0.05]' : 'border-loss/30 bg-loss/[0.05]')} role="status">
                  {result.kind === 'evm' || result.kind === 'solana' ? <Check className="mt-0.5 size-4 shrink-0 text-gain" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-loss" />}
                  <span>{result.message}</span>
                </motion.div>
            ) : null}

          </ToolPanel>

          <ToolPanel tool={tool('converter')} hidden={activeId !== 'converter'}>
            <label className="block">
              <span className="nx-eyebrow text-[9.5px]">ETH amount</span>
              <span className={cn('nx-field mt-2 flex items-center gap-2 px-3', !eth.ok && eth.error && 'border-loss/50')}>
                <input
                  type="text"
                  inputMode="decimal"
                  className="h-11 min-w-0 flex-1 bg-transparent font-mono text-[17px] tabular-nums outline-none"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-label="ETH amount"
                  aria-invalid={!eth.ok && Boolean(eth.error)}
                  aria-describedby="eth-error"
                  spellCheck={false}
                />
                <span className="font-mono text-[12px] text-mute">ETH</span>
              </span>
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-mute">
              {['0.001', '0.1', '1', '32'].map((preset) => (
                <button key={preset} type="button" onClick={() => setAmount(preset)} className={cn('rounded-full border px-2.5 py-1 font-mono transition-colors', amount === preset ? 'border-copper/40 bg-copper/[0.1] text-ink' : 'border-line hover:border-copper/40 hover:text-ink')}>{preset}</button>
              ))}
            </div>
            <p id="eth-error" className="mt-2 min-h-5 text-[11.5px] text-loss" role="alert">{!eth.ok ? eth.error : ''}</p>

            <dl className="mt-2 space-y-2">
              {[
                ['ETH', ethText, 'ETH value'],
                ['Gwei', gweiText, 'gwei value'],
                ['Wei', weiText, 'wei value'],
              ].map(([unit, value, label]) => (
                <div key={unit} className={cn('flex items-center gap-3 rounded-xl border px-3.5 py-3', unit === 'Wei' ? 'border-copper/30 bg-copper/[0.05]' : 'border-line/70 bg-canvas/40')}>
                  <dt className="nx-eyebrow w-10 shrink-0 text-[9.5px]">{unit}</dt>
                  <dd className="min-w-0 flex-1 break-all font-mono text-[13px] tabular-nums">{value}</dd>
                  <CopyButton value={value} label={label} disabled={!eth.ok} />
                </div>
              ))}
            </dl>
            {!eth.ok && !eth.error ? <p className="mt-3 text-[11.5px] text-mute">Enter an amount to see Gwei and wei.</p> : null}

          </ToolPanel>

          <ToolPanel tool={tool('lookup')} hidden={activeId !== 'lookup'}>
            <SearchField value={lookup} onChange={setLookup} placeholder="Filter tokens and collections" label="Filter catalog" className="max-w-sm" />
            {tokens.length === 0 && collections.length === 0 ? (
              <p className="mt-4 text-[12.5px] text-mute">Nothing in the demo catalogue matches “{lookup.trim()}”.</p>
            ) : (
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <div>
                  <p className="nx-eyebrow text-[9.5px]">Tokens</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {tokens.map((token) => (
                      <Link key={token.id} to={`/tokens/${token.id}`} className="group/chip inline-flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-[12.5px] transition-colors hover:border-copper/60">
                        <TokenGlyph token={token} className="size-6 rounded-full text-[8px]" />{token.ticker}
                      </Link>
                    ))}
                    {tokens.length === 0 ? <span className="text-[12px] text-mute">No tokens</span> : null}
                  </div>
                </div>
                <div>
                  <p className="nx-eyebrow text-[9.5px]">Collections</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {collections.map((c) => (
                      <Link key={c.id} to={`/collections/${c.slug}`} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] transition-colors hover:border-copper/60">{c.name}</Link>
                    ))}
                    {collections.length === 0 ? <span className="text-[12px] text-mute">No collections</span> : null}
                  </div>
                </div>
              </div>
            )}

          </ToolPanel>
        </div>
      </div>
    </div>
  )
}
