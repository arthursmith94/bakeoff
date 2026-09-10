import { useCallback, useEffect, useRef, useState } from 'react'
import type { Wallet } from '@solana/wallet-adapter-react'
import { EXPECTED_GENESIS, RPC_URL } from '../lib/env'

declare global {
  interface Window {
    nightly?: {
      solana?: {
        changeNetwork?: (network: { genesisHash: string; url?: string }) => Promise<unknown> | unknown
      }
    }
  }
}

export type SwitchState = 'idle' | 'switching' | 'done' | 'error'

export function useNightly(wallet: Wallet | null, connected: boolean) {
  const isNightly = /nightly/i.test(wallet?.adapter.name ?? '')
  const [state, setState] = useState<SwitchState>('idle')
  const [error, setError] = useState<string | null>(null)
  const autoPromptedFor = useRef<string | null>(null)

  const canSwitch = typeof window !== 'undefined' && typeof window.nightly?.solana?.changeNetwork === 'function'

  const switchNetwork = useCallback(async () => {
    const fn = window.nightly?.solana?.changeNetwork
    if (typeof fn !== 'function') {
      setState('error')
      setError('Nightly extension not detected. Install Nightly, then set its Solana network to Cookie Chain.')
      return
    }
    setState('switching')
    setError(null)
    try {
      await fn({ genesisHash: EXPECTED_GENESIS, url: RPC_URL })
      setState('done')
    } catch (e) {
      setState('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // Prompt once per connection when the connected wallet is Nightly.
  useEffect(() => {
    const key = wallet?.adapter.name ?? null
    if (!connected || !isNightly || !canSwitch) return
    if (autoPromptedFor.current === key) return
    autoPromptedFor.current = key
    void switchNetwork()
  }, [connected, isNightly, canSwitch, wallet, switchNetwork])

  // Reset the prompt guard on disconnect; the visible state is derived so no extra render is needed.
  useEffect(() => {
    if (!connected) autoPromptedFor.current = null
  }, [connected])

  return { isNightly, canSwitch, state: connected ? state : 'idle', error: connected ? error : null, switchNetwork }
}
