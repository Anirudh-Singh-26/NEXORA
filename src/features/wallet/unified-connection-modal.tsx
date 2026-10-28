import { useState, type ReactNode } from 'react'
import {
  AlertTriangle, CheckCircle2, ExternalLink, LoaderCircle, Power, ShieldCheck, Wallet as WalletIcon,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useWallet } from '@/features/wallet-provider'
import { useTronWallet } from '@/features/tron/tron-provider'
import type { ChainConnectionSummary } from '@/features/wallet/wallet-connections'
import { StatusBadge } from '@/features/wallet/wallet-ui'
import { shortenAddress } from '@/features/wallet/wallet-utils'
import { shortenTronAddress } from '@/lib/tron/format'
import { TRON_NETWORK_LABEL } from '@/lib/tron/network'
import {
  networkFor,
  verifyEvmNetwork,
  verifySolanaNetwork,
  verifyTonNetwork,
  verifyTronNetwork,
  networkStatusLabel,
} from '@/lib/network/environments'

export interface UnifiedConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ton: ChainConnectionSummary
}

/* -------------------------------------------------------------------------- */
/* Presentational pieces (no wallet logic lives here)                            */
/* -------------------------------------------------------------------------- */

type RowState = 'connected' | 'mismatch' | 'unavailable' | 'idle'

interface ModalRowProps {
  glyph: string
  name: string
  network: string
  source: string
  state: RowState
  /** Right-hand control: connect button, status badge + disconnect, or an install link. */
  control: ReactNode
  /** Shown only while connected: the public address and the verification result. */
  detail?: ReactNode
}

function ModalRow({ glyph, name, network, source, state, control, detail }: ModalRowProps) {
  return (
    <li className={`wlx-modal-row is-${state}`} data-eco={name.toLowerCase()}>
      <div className="wlx-modal-row__main">
        <span className="wlx-glyph wlx-glyph--sm" aria-hidden="true">{glyph}</span>
        <div className="wlx-modal-row__text">
          <h3 className="wlx-modal-row__name">
            {name}
            <span className="wlx-env-tag">{network}</span>
          </h3>
          <p className="wlx-modal-row__source">{source}</p>
        </div>
        <div className="wlx-modal-row__control">{control}</div>
      </div>
      {detail}
    </li>
  )
}

function ModalDetail({ address, title, ok, children }: { address: string; title?: string; ok: boolean; children: ReactNode }) {
  return (
    <div className="wlx-modal-row__detail">
      <code title={title}>{address}</code>
      <span className={`wlx-modal-verify ${ok ? 'is-ok' : 'is-warn'}`}>
        {ok ? <CheckCircle2 size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
        {children}
      </span>
    </div>
  )
}

function DisconnectButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="wlt-btn wlt-btn--sm wlt-btn--quiet wlx-modal-disconnect" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      <Power size={13} aria-hidden="true" />
      <span>Disconnect</span>
    </button>
  )
}

export function UnifiedConnectionModal({ open, onOpenChange, ton }: UnifiedConnectionModalProps) {
  const wallet = useWallet()
  const tron = useTronWallet()
  const [connectingEco, setConnectingEco] = useState<string | null>(null)

  // Descriptors
  const evmTarget = networkFor('evm')
  const solTarget = networkFor('solana')
  const tonTarget = networkFor('ton')
  const tronTarget = networkFor('tron')

  // EVM verification
  const evmConnected = wallet.evmAddress !== null
  const evmVer = verifyEvmNetwork(wallet.chainId)

  // Solana verification
  const solConnected = wallet.solanaAddress !== null
  const solVer = verifySolanaNetwork(wallet.solanaNetworkName)

  // TON verification
  const tonConnected = ton.phase === 'connected' && ton.address !== null
  const tonVer = verifyTonNetwork(ton.chain ?? null, ton.networkKind ?? null)

  // TRON verification
  const tronConnected = tron.status === 'connected' && tron.address !== null
  const tronIdentity = tron.network.status === 'ready' ? tron.network.identity : null
  const tronVer = verifyTronNetwork(tronIdentity)

  async function handleConnectEvm() {
    setConnectingEco('evm')
    try {
      await wallet.connectEvm()
    } finally {
      setConnectingEco(null)
    }
  }

  async function handleConnectSolana() {
    setConnectingEco('solana')
    try {
      await wallet.connectSolana()
    } finally {
      setConnectingEco(null)
    }
  }

  function handleConnectTon() {
    if (ton.connect) {
      ton.connect()
    }
  }

  async function handleConnectTron() {
    setConnectingEco('tron')
    try {
      await tron.connect()
    } finally {
      setConnectingEco(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wlx-unified-modal top-1/2 flex max-h-[calc(100dvh-1.5rem)] w-[min(32rem,calc(100%-1.5rem))] -translate-y-1/2 flex-col overflow-hidden border border-line bg-raised p-0 shadow-2xl">
        <header className="wlx-modal-head">
          <span className="wlx-glyph wlx-glyph--sm" aria-hidden="true">
            <WalletIcon size={16} />
          </span>
          <div className="wlx-modal-head__text">
            <DialogTitle className="wlx-modal-title">Connect wallet</DialogTitle>
            <DialogDescription className="wlx-modal-desc">
              Unified connection for all 4 supported ecosystems
            </DialogDescription>
          </div>
          <span className="wlx-modal-env is-testnet">
            <i aria-hidden="true" />
            Testnet
          </span>
        </header>

        <ul className="wlx-modal-list">
          {/* 1. Ethereum */}
          <ModalRow
            glyph="Ξ"
            name="Ethereum"
            network={`${evmTarget.label} (${String(evmTarget.networkId)})`}
            source="Reown AppKit · EVM accounts"
            state={evmConnected ? (evmVer.status === 'verified' ? 'connected' : 'mismatch') : 'idle'}
            control={evmConnected ? (
              <>
                <StatusBadge tone={evmVer.status === 'verified' ? 'connected' : 'warn'}>
                  {networkStatusLabel(evmVer.status)}
                </StatusBadge>
                <DisconnectButton label="Disconnect Ethereum wallet" onClick={() => void wallet.disconnectEvm()} disabled={wallet.disconnectingEcosystem !== null} />
              </>
            ) : (
              <button
                type="button"
                className="wlt-btn wlt-btn--sm wlt-btn--primary"
                onClick={() => void handleConnectEvm()}
                disabled={wallet.isEvmConnecting || connectingEco === 'evm'}
                aria-busy={wallet.isEvmConnecting}
              >
                {wallet.isEvmConnecting ? (
                  <LoaderCircle size={13} className="wlt-spin" aria-hidden="true" />
                ) : (
                  <WalletIcon size={13} aria-hidden="true" />
                )}
                Connect
              </button>
            )}
            detail={evmConnected && wallet.evmAddress ? (
              <ModalDetail address={shortenAddress(wallet.evmAddress, 6, 4)} title={wallet.evmAddress} ok={evmVer.status === 'verified'}>
                {evmVer.status === 'verified' ? `Verified ${evmTarget.label}` : (
                  <span title={evmVer.message ?? undefined}>{evmVer.status === 'mismatch' ? `${evmVer.reportedName ?? 'Wrong network'} · switch to ${evmTarget.label}` : (evmVer.reportedName ?? 'Network unverified')}</span>
                )}
              </ModalDetail>
            ) : null}
          />

          {/* 2. Solana */}
          <ModalRow
            glyph="◎"
            name="Solana"
            network={solTarget.label}
            source="Reown AppKit · Solana adapter"
            state={solConnected ? (solVer.status === 'verified' ? 'connected' : 'mismatch') : 'idle'}
            control={solConnected ? (
              <>
                <StatusBadge tone={solVer.status === 'verified' ? 'connected' : 'warn'}>
                  {networkStatusLabel(solVer.status)}
                </StatusBadge>
                <DisconnectButton label="Disconnect Solana wallet" onClick={() => void wallet.disconnectSolana()} disabled={wallet.disconnectingEcosystem !== null} />
              </>
            ) : (
              <button
                type="button"
                className="wlt-btn wlt-btn--sm wlt-btn--primary"
                onClick={() => void handleConnectSolana()}
                disabled={wallet.isSolanaConnecting || connectingEco === 'solana'}
                aria-busy={wallet.isSolanaConnecting}
              >
                {wallet.isSolanaConnecting ? (
                  <LoaderCircle size={13} className="wlt-spin" aria-hidden="true" />
                ) : (
                  <WalletIcon size={13} aria-hidden="true" />
                )}
                Connect
              </button>
            )}
            detail={solConnected && wallet.solanaAddress ? (
              <ModalDetail address={shortenAddress(wallet.solanaAddress, 6, 4)} title={wallet.solanaAddress} ok={solVer.status === 'verified'}>
                {solVer.status === 'verified' ? `Verified ${solTarget.label}` : (
                  <span title={solVer.message ?? undefined}>{solVer.status === 'mismatch' ? `${solVer.reportedName ?? 'Wrong cluster'} · switch to ${solTarget.label}` : (solVer.reportedName ?? 'Network unverified')}</span>
                )}
              </ModalDetail>
            ) : null}
          />

          {/* 3. TON */}
          <ModalRow
            glyph="TON"
            name="TON"
            network={`${tonTarget.label} (${String(tonTarget.networkId)})`}
            source="TON Connect · official web SDK"
            state={tonConnected ? (tonVer.status === 'verified' ? 'connected' : 'mismatch') : ton.phase === 'setup' || ton.phase === 'unavailable' ? 'unavailable' : 'idle'}
            control={tonConnected ? (
              <>
                <StatusBadge tone={tonVer.status === 'verified' ? 'connected' : 'warn'}>
                  {networkStatusLabel(tonVer.status)}
                </StatusBadge>
                <DisconnectButton label="Disconnect TON wallet" onClick={() => ton.disconnect?.()} disabled={ton.disconnecting} />
              </>
            ) : ton.phase === 'setup' ? (
              <StatusBadge tone="warn">Setup needed</StatusBadge>
            ) : ton.phase === 'unavailable' ? (
              <StatusBadge tone="idle">Unavailable</StatusBadge>
            ) : (
              <button
                type="button"
                className="wlt-btn wlt-btn--sm wlt-btn--primary"
                onClick={handleConnectTon}
                disabled={!ton.connect || ton.phase === 'connecting' || ton.phase === 'checking'}
                aria-busy={ton.phase === 'connecting'}
              >
                {ton.phase === 'connecting' ? (
                  <LoaderCircle size={13} className="wlt-spin" aria-hidden="true" />
                ) : (
                  <WalletIcon size={13} aria-hidden="true" />
                )}
                Connect
              </button>
            )}
            detail={tonConnected && ton.address ? (
              <ModalDetail address={shortenAddress(ton.address, 6, 4)} title={ton.address} ok={tonVer.status === 'verified'}>
                {tonVer.status === 'verified' ? `Verified ${tonTarget.label}` : (
                  <span title={tonVer.message ?? undefined}>{tonVer.status === 'mismatch' ? `${tonVer.reportedName ?? 'Wrong chain'} · switch to ${tonTarget.label}` : (tonVer.reportedName ?? 'Network unverified')}</span>
                )}
              </ModalDetail>
            ) : null}
          />

          {/* 4. TRON */}
          <ModalRow
            glyph="TRX"
            name="TRON"
            network={tronTarget.label}
            source="TronLink · TRON Web3 adapter"
            state={tronConnected ? (tronVer.status === 'verified' ? 'connected' : 'mismatch') : tron.availability === 'not-installed' ? 'unavailable' : 'idle'}
            control={tronConnected ? (
              <>
                <StatusBadge tone={tronVer.status === 'verified' ? 'connected' : 'warn'}>
                  {networkStatusLabel(tronVer.status)}
                </StatusBadge>
                <DisconnectButton label="Disconnect TRON wallet" onClick={() => void tron.disconnect()} disabled={tron.status === 'disconnecting'} />
              </>
            ) : tron.availability === 'not-installed' ? (
              <a
                href={tron.walletUrl ?? 'https://www.tronlink.org/'}
                target="_blank"
                rel="noopener noreferrer"
                className="wlt-btn wlt-btn--sm"
              >
                Install TronLink
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            ) : (
              <button
                type="button"
                className="wlt-btn wlt-btn--sm wlt-btn--primary"
                onClick={() => void handleConnectTron()}
                disabled={tron.status === 'connecting' || connectingEco === 'tron'}
                aria-busy={tron.status === 'connecting'}
              >
                {tron.status === 'connecting' ? (
                  <LoaderCircle size={13} className="wlt-spin" aria-hidden="true" />
                ) : (
                  <WalletIcon size={13} aria-hidden="true" />
                )}
                Connect
              </button>
            )}
            detail={tronConnected && tron.address ? (
              <ModalDetail address={shortenTronAddress(tron.address, 6, 4)} title={tron.address} ok={tronVer.status === 'verified'}>
                {tronVer.status === 'verified' ? `Verified ${tronTarget.label}` : (
                  <span title={tronVer.message ?? undefined}>{tronIdentity ? TRON_NETWORK_LABEL[tronIdentity.kind] : 'Network unverified'}{tronVer.status === 'mismatch' ? ` · switch to ${tronTarget.label}` : ''}</span>
                )}
              </ModalDetail>
            ) : null}
          />
        </ul>

        <footer className="wlx-modal-foot">
          <span className="wlx-modal-foot__note">
            <ShieldCheck size={14} aria-hidden="true" />
            Public-address access only · Keys stay in your wallet
          </span>
          <button type="button" className="wlt-btn wlt-btn--sm" onClick={() => onOpenChange(false)}>
            Done
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
