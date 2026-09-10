import { useCallback, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { About, Footer } from './components/About'
import { Analytics } from './components/Analytics'
import { CookieButton } from './components/CookieButton'
import { Header } from './components/Header'
import { Leaderboard } from './components/Leaderboard'
import { NetworkBanner } from './components/NetworkBanner'
import { OvenPanel } from './components/OvenPanel'
import { Toasts } from './components/Toasts'
import { TxFeed } from './components/TxFeed'
import { useBalance } from './hooks/useBalance'
import { useChainStats } from './hooks/useChainStats'
import { useGame } from './hooks/useGame'
import { useLeaderboard } from './hooks/useLeaderboard'
import { useNightly } from './hooks/useNightly'
import { useToasts } from './hooks/useToasts'
import { BakeoffClient, type TxSigner } from './lib/bakeoff'
import { MAX_BAKE } from './lib/config'
import { formatInt } from './lib/format'

export default function App() {
  const { connection } = useConnection()
  const { publicKey, signTransaction, sendTransaction, wallet, connected } = useWallet()
  const client = useMemo(() => new BakeoffClient(connection), [connection])
  const chain = useChainStats(connection)
  const { balance, refresh: refreshBalance } = useBalance(connection, publicKey)
  const nightly = useNightly(wallet, connected)
  const { toasts, push } = useToasts()
  const [refreshKey, setRefreshKey] = useState(0)

  const signer = useMemo<TxSigner | null>(
    () => (publicKey ? { publicKey, signTransaction, sendTransaction } : null),
    [publicKey, signTransaction, sendTransaction],
  )

  const onConfirmed = useCallback(() => {
    void refreshBalance()
    setRefreshKey((k) => k + 1)
  }, [refreshBalance])

  const game = useGame({ client, signer, balance, onConfirmed })
  const board = useLeaderboard(client, refreshKey)

  const copy = useCallback(
    (text: string, label: string) => {
      navigator.clipboard
        ?.writeText(text)
        .then(() => push(`${label} copied`, 'ok'))
        .catch(() => push('Copy failed — select and copy manually', 'err'))
    },
    [push],
  )

  const address = publicKey?.toBase58() ?? null
  const multiplier = game.player?.multiplier ?? 1
  const queued = game.pending + game.inFlightN

  return (
    <div className="app" id="top">
      <Header stats={chain} address={address} balance={balance} onCopy={copy} />
      <NetworkBanner
        connected={connected}
        isNightly={nightly.isNightly}
        canSwitch={nightly.canSwitch}
        state={nightly.state}
        error={nightly.error}
        rpcGenesis={chain.genesisHash}
        onSwitch={() => void nightly.switchNetwork()}
      />
      {chain.error && !chain.slot && (
        <div className="banner banner-err" role="alert">
          <div className="banner-body">
            <strong>RPC unreachable.</strong> {chain.error}
          </div>
        </div>
      )}

      <main className="grid">
        <section className="card hero" aria-labelledby="hero-title">
          <h1 id="hero-title" className="sr-only">
            Bake cookies
          </h1>
          <div className="hero-counter">
            <span className="hero-number" aria-live="polite">
              {formatInt(game.optimisticCookies)}
            </span>
            <span className="hero-label">cookies</span>
          </div>
          <CookieButton multiplier={multiplier} onBake={game.click} burstSignal={game.celebration?.at} />
          <div className="hero-meta">
            <span className="pill">×{multiplier} per click</span>
            <span className={`pill ${queued ? 'pill-warn' : ''}`}>
              {queued ? `${queued} click${queued === 1 ? '' : 's'} ${game.inFlightN ? 'baking' : 'queued'}` : 'oven idle'}
            </span>
            {game.lostClicks > 0 && (
              <button type="button" className="pill pill-err pill-btn" onClick={game.retryAll}>
                {game.lostClicks} unsent — retry
              </button>
            )}
          </div>
          <p className="muted small hero-hint">
            {!connected
              ? game.offlineCapReached
                ? 'Queue full — connect Nightly to bake these clicks on-chain.'
                : `Not connected: clicks are queued locally (up to 100) and baked once you connect. Space / Enter also bake.`
              : `Batches of up to ${MAX_BAKE} clicks are sent every 1.5 s. Hold Enter for a rapid bake. Each batch is one wallet signature.`}
          </p>
        </section>

        <div className="col-side">
          <OvenPanel
            player={game.player}
            playerLoaded={game.playerLoaded}
            connected={connected}
            balance={balance}
            busy={game.busy !== null}
            error={game.upgradeError}
            celebration={game.celebration}
            onUpgrade={() => {
              void game.upgrade()
            }}
          />
          <Analytics stats={game.stats} />
        </div>

        <TxFeed
          txs={game.txs}
          lostClicks={game.lostClicks}
          onRetry={game.retry}
          onRetryAll={game.retryAll}
          onSwitchNetwork={nightly.canSwitch ? () => void nightly.switchNetwork() : undefined}
        />

        <Leaderboard players={board.players} global={board.global} loading={board.loading} error={board.error} updatedAt={board.updatedAt} me={address} />

        <About onCopy={copy} />
      </main>
      <Footer />
      <Toasts toasts={toasts} />
    </div>
  )
}
