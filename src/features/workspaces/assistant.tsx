import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, RotateCcw, Send, Sparkles } from 'lucide-react'
import { assistantPrompts } from '@/data/catalog'
import { dur, ease } from '@/lib/motion'
import { cn } from '@/lib/utils'

type ChatMessage = { role: 'user' | 'assistant'; text: string; link?: { to: string; label: string } }


function scriptedReply(input: string): Omit<ChatMessage, 'role'> {
  if (/airdrop|drop|campaign/i.test(input)) return { text: 'Open Drops & Airdrops to review the local campaign examples. This prototype cannot confirm eligibility or verify live campaigns.', link: { to: '/drops', label: 'Open Drops' } }
  if (/token|price|market/i.test(input)) return { text: 'Token prices in NEXORA are illustrative demo quotes. Open Tokens to compare the seeded catalog and inspect each token detail.', link: { to: '/tokens', label: 'Open Tokens' } }
  if (/collection|nft|asset/i.test(input)) return { text: 'Browse Collections to filter by network and category, or open a collection to inspect its sample assets.', link: { to: '/collections', label: 'Open Collections' } }
  return { text: 'I can help you navigate the NEXORA demo. Try asking about tokens, collections, airdrops, or watchlists. This is a scripted local response, not a live AI service.' }
}


export function AssistantWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [message, setMessage] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const prompts = assistantPrompts

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [messages])

  const send = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    setMessages((items) => [...items, { role: 'user', text: trimmed }, { role: 'assistant', ...scriptedReply(trimmed) }])
    setMessage('')
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="nx-panel flex h-[min(640px,calc(100dvh-14rem))] min-h-[460px] flex-col overflow-hidden rounded-2xl" aria-label="Assistant conversation">
        <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="nx-brand-mark flex size-8 items-center justify-center rounded-lg border border-copper/30 text-copper"><Sparkles size={15} /></span>
            <div>
              <p className="text-[13.5px] font-medium leading-none">NEXORA Assistant</p>
              <p className="mt-1.5 text-[11px] text-mute">Scripted guidance · no live AI connection</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="nx-eyebrow text-[9px] text-copper">Local demo</span>
            {messages.length > 0 ? <button type="button" onClick={() => setMessages([])} className="inline-flex items-center gap-1 text-[11.5px] text-mute hover:text-ink"><RotateCcw size={12} /> Clear</button> : null}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4" role="log" aria-live="polite">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
              <Sparkles className="mb-4 text-copper" size={26} />
              <h2 className="font-display text-2xl">Where do you want to explore?</h2>
              <p className="mt-2 text-sm text-mute">Ask about collections, tokens, campaigns, or watchlists.</p>
            </div>
          ) : null}
          {messages.map((item, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.base, ease }} className={cn('max-w-[88%] rounded-xl p-3.5 text-[13px] leading-6', item.role === 'user' ? 'ml-auto bg-copper/[0.12] border border-copper/25' : 'border border-line bg-canvas/70')}>
              <p className="mb-1 text-[10px] uppercase tracking-widest text-copper">{item.role === 'user' ? 'You' : 'NEXORA demo'}</p>
              {item.text}
              {item.link ? <Link to={item.link.to} className="mt-2 inline-flex items-center gap-1 text-[12px] text-copper hover:text-ink">{item.link.label} <ArrowRight size={13} /></Link> : null}
            </motion.div>
          ))}
          <div ref={endRef} />
        </div>

        <form className="flex gap-2 border-t border-line/70 p-3" onSubmit={(e) => { e.preventDefault(); send(message) }}>
          <input value={message} onChange={(e) => setMessage(e.target.value)} className="nx-field min-w-0 flex-1 px-3.5 py-2.5 text-[13px] outline-none placeholder:text-mute/70" placeholder="Ask about the demo..." aria-label="Message" />
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 text-sm font-medium text-canvas transition-opacity hover:opacity-90" type="submit"><Send size={14} /> Send</button>
        </form>
      </section>

      <aside className="space-y-4">
        <div className="nx-surface rounded-xl p-4">
          <p className="nx-eyebrow text-[9.5px]">Try asking</p>
          <ul className="mt-3 space-y-1.5">
            {prompts.map((prompt) => (
              <li key={prompt}><button type="button" onClick={() => send(prompt)} className="w-full rounded-lg border border-line/70 px-3 py-2 text-left text-[12.5px] text-mute transition-colors hover:border-copper/40 hover:text-ink">{prompt}</button></li>
            ))}
          </ul>
        </div>
        <div className="nx-surface rounded-xl p-4">
          <h3 className="nx-eyebrow text-[9.5px]">What it can do</h3>
          <ul className="mt-3 space-y-2.5 text-[12.5px] leading-5 text-mute"><li>• Explain where demo data lives</li><li>• Point to relevant catalog pages</li><li>• Explain basic Web3 terms</li></ul>
          <p className="mt-4 border-t border-line/70 pt-3 text-[11.5px] leading-5 text-mute">It cannot research live campaigns, inspect wallets, or provide verified financial data.</p>
        </div>
      </aside>
    </div>
  )
}

/* ── Tools: utility studio ─────────────────────────────────────────────── */
