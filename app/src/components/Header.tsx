import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import type { ChainStats } from '../hooks/useChainStats'
import { COOKIE_CHAIN, explorerAddress } from '../lib/config'
import { formatCook, formatInt, shortAddr } from '../lib/format'
import { IS_MAINNET_RPC, RPC_URL } from '../lib/env'

interface Props {
  stats: ChainStats
  address: string | null
  balance: number | null
  onCopy: (text: string, label: string) => void
}

export function Header({ stats, address, balance, onCopy }: Props) {
  return (
    <header className="header">
      <a className="brand" href="#top" aria-label="Bakeoff home">
        <span className="brand-cookie" aria-hidden="true" />
        <span className="brand-text">
          <strong>Bakeoff</strong>
          <small>on-chain cookie clicker · {COOKIE_CHAIN.name}</small>
        </span>
      </a>

      <div className="chainstats" aria-label="Live chain stats">
        <span className={`live-dot ${stats.live ? 'is-live' : ''}`} title={stats.live ? 'Receiving slot updates' : 'Waiting for RPC…'} />
        <Stat label="slot" value={stats.slot === null ? '—' : formatInt(stats.slot)} />
        <Stat label="TPS" value={stats.tps === null ? '—' : stats.tps >= 100 ? formatInt(Math.round(stats.tps)) : stats.tps.toFixed(1)} />
        <Stat label="block" value={stats.slotTimeMs === null ? '—' : `${Math.round(stats.slotTimeMs)} ms`} />
        {!IS_MAINNET_RPC && (
          <span className="pill pill-warn" title={RPC_URL}>
            custom RPC
          </span>
        )}
      </div>

      <div className="walletbox">
        {address && (
          <div className="addr-chip" title={address}>
            <span className="addr-balance">{balance === null ? '…' : `${formatCook(balance)} ${COOKIE_CHAIN.symbol}`}</span>
            <span className="addr-sep" aria-hidden="true">·</span>
            <span className="addr-text">{shortAddr(address)}</span>
            <button type="button" className="icon-btn" onClick={() => onCopy(address, 'Address')} aria-label="Copy address" title="Copy address">
              <CopyIcon />
            </button>
            <a className="icon-btn" href={explorerAddress(address)} target="_blank" rel="noreferrer" aria-label="View on explorer" title="View on Cookiescan">
              <ExternalIcon />
            </a>
          </div>
        )}
        <WalletMultiButton />
      </div>
    </header>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </span>
  )
}

export function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

export function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  )
}
