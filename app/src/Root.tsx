import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import type { Adapter, WalletError } from '@solana/wallet-adapter-base'
import App from './App'
import { RPC_URL, WS_URL } from './lib/env'

export function Root() {
  // Nightly (and any other Wallet Standard wallet) registers itself; no adapters need to be listed.
  const wallets = useMemo<Adapter[]>(() => [], [])
  const config = useMemo(() => ({ commitment: 'confirmed' as const, wsEndpoint: WS_URL }), [])
  const onError = (e: WalletError) => {
    // Surfaced in the UI via the tx feed / banners; keep the console clean of stack traces.
    if (e.name !== 'WalletConnectionError' && e.name !== 'WalletNotSelectedError') console.warn('[wallet]', e.name, e.message)
  }
  return (
    <ConnectionProvider endpoint={RPC_URL} config={config}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
