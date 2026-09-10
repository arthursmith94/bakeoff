import { useState } from 'react'
import type { SwitchState } from '../hooks/useNightly'
import { COOKIE_CHAIN } from '../lib/config'
import { EXPECTED_GENESIS, IS_MAINNET_RPC, RPC_URL } from '../lib/env'
import { shortAddr } from '../lib/format'

interface Props {
  connected: boolean
  isNightly: boolean
  canSwitch: boolean
  state: SwitchState
  error: string | null
  rpcGenesis: string | null
  onSwitch: () => void
}

export function NetworkBanner({ connected, isNightly, canSwitch, state, error, rpcGenesis, onSwitch }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const rpcMismatch = rpcGenesis !== null && rpcGenesis !== EXPECTED_GENESIS

  if (!connected && !rpcMismatch) return null
  if (dismissed && state !== 'error') return null

  return (
    <div className={`banner ${state === 'error' ? 'banner-err' : ''}`} role="region" aria-label="Network">
      <div className="banner-body">
        {rpcMismatch && !IS_MAINNET_RPC ? (
          <>
            <strong>Dev mode.</strong> The app is pointed at <code>{RPC_URL}</code> (genesis {shortAddr(rpcGenesis)}), not Cookie Chain mainnet. Your wallet must be on the same network.
          </>
        ) : rpcMismatch ? (
          <>
            <strong>Unexpected network.</strong> RPC genesis {shortAddr(rpcGenesis)} does not match Cookie Chain ({shortAddr(EXPECTED_GENESIS)}).
          </>
        ) : (
          <>
            <strong>{isNightly ? 'Nightly' : 'Your wallet'} must be on {COOKIE_CHAIN.name}.</strong> Make sure it is set to RPC <code>{RPC_URL}</code>
            {state === 'done' && <span className="pill pill-ok">switch requested</span>}
            {state === 'error' && error && <span className="banner-err-text"> — {error}</span>}
          </>
        )}
      </div>
      <div className="banner-actions">
        {canSwitch && (
          <button type="button" className="btn btn-sm" onClick={onSwitch} disabled={state === 'switching'}>
            {state === 'switching' ? 'Switching…' : 'Switch network'}
          </button>
        )}
        {!canSwitch && connected && !isNightly && (
          <a className="btn btn-sm btn-ghost" href="https://nightly.app" target="_blank" rel="noreferrer">
            Get Nightly
          </a>
        )}
        <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setDismissed(true)}>
          ×
        </button>
      </div>
    </div>
  )
}
