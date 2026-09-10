import type { PlayerAccount } from '../lib/bakeoff'
import type { ClassifiedError } from '../lib/errors'
import { COOKIE_CHAIN, COOKIE_JAR, FEE_LAMPORTS, MAX_LEVEL, MULTIPLIERS, explorerAddress, multiplierForLevel, upgradeCostLamports } from '../lib/config'
import { formatCook, shortAddr } from '../lib/format'

interface Props {
  player: PlayerAccount | null
  playerLoaded: boolean
  connected: boolean
  balance: number | null
  busy: boolean
  error: ClassifiedError | null
  celebration: { level: number; multiplier: number; at: number } | null
  onUpgrade: () => void
}

export function OvenPanel({ player, playerLoaded, connected, balance, busy, error, celebration, onUpgrade }: Props) {
  const level = player?.ovenLevel ?? 0
  const multiplier = player?.multiplier ?? multiplierForLevel(0)
  const maxed = level >= MAX_LEVEL
  const cost = maxed ? 0 : upgradeCostLamports(level)
  const nextMult = maxed ? multiplier : multiplierForLevel(level + 1)

  let reason: string | null = null
  if (!connected) reason = 'Connect a wallet to upgrade'
  else if (!playerLoaded) reason = 'Loading your oven…'
  else if (!player) reason = 'Bake at least once first (creates your player account)'
  else if (maxed) reason = 'Max level reached — your oven is legendary'
  else if (balance !== null && balance < cost + FEE_LAMPORTS) reason = `Need ${formatCook(cost)} ${COOKIE_CHAIN.symbol} (you have ${formatCook(balance)})`
  else if (busy) reason = 'Waiting for the current transaction…'

  const recentCelebration = celebration !== null

  return (
    <section className={`card oven ${recentCelebration ? 'is-celebrating' : ''}`} aria-labelledby="oven-title">
      <div className="card-head">
        <h2 id="oven-title">Oven</h2>
        <span className="pill">
          level {level} / {MAX_LEVEL}
        </span>
      </div>

      <div className="oven-art" aria-hidden="true">
        <div className="oven-body">
          <div className="oven-window">
            <span className="oven-flame" style={{ opacity: 0.35 + (level / MAX_LEVEL) * 0.65 }} />
          </div>
          <div className="oven-dial" />
        </div>
      </div>

      <div className="oven-stats">
        <div>
          <span className="muted">cookies per click</span>
          <strong className="big">×{multiplier}</strong>
        </div>
        {!maxed && (
          <div>
            <span className="muted">after upgrade</span>
            <strong className="big accent">×{nextMult}</strong>
          </div>
        )}
      </div>

      <div className="level-track" role="img" aria-label={`Oven level ${level} of ${MAX_LEVEL}`}>
        {MULTIPLIERS.map((m, i) => (
          <span key={m} className={`level-seg ${i <= level ? 'is-on' : ''}`} title={`level ${i}: ×${m}`} />
        ))}
      </div>

      {recentCelebration && (
        <p className="celebrate" role="status">
          Level {celebration.level}! Your oven now bakes ×{celebration.multiplier} per click.
        </p>
      )}

      <button type="button" className="btn btn-primary btn-block" onClick={onUpgrade} disabled={reason !== null} title={reason ?? undefined}>
        {maxed ? 'Max level' : busy ? 'Upgrading…' : `Upgrade for ${formatCook(cost)} ${COOKIE_CHAIN.symbol}`}
      </button>
      {reason && !maxed && <p className="muted small reason">{reason}</p>}
      {error && (
        <p className="err-text small">
          {error.title}: {error.detail}{' '}
          {error.needsFunds && (
            <a href={COOKIE_CHAIN.bridge} target="_blank" rel="noreferrer">
              Get COOK via bridge ↗
            </a>
          )}
        </p>
      )}

      <p className="muted small">
        Upgrade costs go straight to the community <strong>Cookie Jar</strong> (
        <a href={explorerAddress(COOKIE_JAR)} target="_blank" rel="noreferrer" title={COOKIE_JAR}>
          {shortAddr(COOKIE_JAR)} ↗
        </a>
        ), a vault that funds Cookie Chain builders. Cost doubles every level: 0.05 → 0.1 → 0.2 … {formatCook(upgradeCostLamports(MAX_LEVEL - 1))} {COOKIE_CHAIN.symbol}.
      </p>
    </section>
  )
}
