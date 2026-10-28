import { useMemo } from 'react'
import { CircleAlert } from 'lucide-react'
import type { CopyController } from '@/features/wallet/wallet-copy'
import { RowSkeletons } from '@/features/wallet/wallet-ui'
import { TonProvider } from '@/features/ton/ton-provider'
import { TonSectionFrame } from '@/features/ton/ton-section-frame'
import { TonWalletPanel } from '@/features/ton/ton-wallet-panel'
import { useTonManifestStatus } from '@/features/ton/use-ton-manifest-status'
import type { SummaryReporter } from '@/features/wallet/wallet-connections'
import { readTonConfig } from '@/lib/ton/env'
import { TON_MANIFEST_PATH } from '@/lib/ton/manifest'
import '@/styles/ton-wallet.css'

function SetupNeeded({ children }: { children: React.ReactNode }) {
  return (
    <TonSectionFrame chip={{ tone: 'warn', label: 'Setup needed' }}>
      <div className="ton-body">{children}</div>
    </TonSectionFrame>
  )
}

function ConfiguredSection({ manifestUrl, apiBase, copy, onReport }: { manifestUrl: string; apiBase: string; copy: CopyController; onReport?: SummaryReporter }) {
  const manifest = useTonManifestStatus(manifestUrl)

  if (manifest.status === 'checking') {
    return (
      <TonSectionFrame chip={{ tone: 'idle', label: 'Checking setup…' }} announcement="Checking the TON Connect setup.">
        <RowSkeletons count={1} label="Checking the TON Connect setup" />
      </TonSectionFrame>
    )
  }

  if (manifest.status === 'placeholder') {
    return (
      <SetupNeeded>
        <div className="ton-error is-warn" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <div>
            <strong>The TON Connect manifest still contains placeholder values</strong>
            <p>Wallets download <code>{TON_MANIFEST_PATH}</code> to learn which app is asking to connect, so TON wallet connection stays off until it describes this site. Before connecting:</p>
            <ol className="ton-steps">
              <li>Edit <code>public{TON_MANIFEST_PATH}</code>: set <code>url</code> to the public HTTPS origin this app is served from, and <code>iconUrl</code> to an absolute URL of a 180×180 PNG on that origin (for example <code>public/nexora-icon-180.png</code>).</li>
              <li>Rebuild or redeploy, then reload this page. Mobile wallets cannot reach <code>localhost</code>; for phone testing use an HTTPS tunnel and put its origin in the manifest.</li>
              <li>Optional: set <code>VITE_TONCONNECT_MANIFEST_URL</code> to serve the manifest from a different absolute URL.</li>
            </ol>
          </div>
        </div>
      </SetupNeeded>
    )
  }

  return (
    <TonProvider manifestUrl={manifestUrl}>
      <TonWalletPanel copy={copy} manifest={manifest} apiBase={apiBase} onReport={onReport} />
    </TonProvider>
  )
}

/** Entry point of the lazily loaded TON chunk: validates configuration first, then mounts TON Connect. */
export function TonWalletSection({ copy, onReport }: { copy: CopyController; onReport?: SummaryReporter }) {
  const config = useMemo(() => readTonConfig(), [])
  if (!config.ok) {
    return (
      <SetupNeeded>
        <div className="ton-error is-warn" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <div><strong>TON configuration problem</strong>{config.messages.map((message) => <p key={message}>{message}</p>)}</div>
        </div>
      </SetupNeeded>
    )
  }
  return <ConfiguredSection manifestUrl={config.manifestUrl} apiBase={config.apiBase} copy={copy} onReport={onReport} />
}
