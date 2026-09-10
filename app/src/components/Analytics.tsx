import { useState } from 'react'
import type { SessionStats } from '../hooks/useGame'
import { COOKIE_CHAIN, FEE_LAMPORTS } from '../lib/config'
import { formatCook, formatInt, formatMs } from '../lib/format'
import { Tile } from './Leaderboard'

export function Analytics({ stats }: { stats: SessionStats }) {
  const lat = stats.latencies
  const avg = lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null
  const min = lat.length ? Math.min(...lat) : null
  const max = lat.length ? Math.max(...lat) : null
  return (
    <section className="card analytics" aria-labelledby="an-title">
      <div className="card-head">
        <h2 id="an-title">Your session</h2>
        <span className="muted small">this tab only</span>
      </div>
      <div className="tiles tiles-3">
        <Tile label="clicks" value={formatInt(stats.clicks)} />
        <Tile label="cookies baked" value={formatInt(stats.cookiesBaked)} />
        <Tile label="txs sent" value={formatInt(stats.txsSent)} sub={`${stats.confirmed} confirmed · ${stats.failed} failed`} />
        <Tile label="avg confirmation" value={avg === null ? '—' : formatMs(avg)} sub={min !== null && max !== null ? `${formatMs(min)} – ${formatMs(max)}` : undefined} />
        <Tile label="fees paid" value={`≈ ${formatCook(stats.feesLamports, 6)}`} sub={`${COOKIE_CHAIN.symbol} · ${FEE_LAMPORTS} lamports × ${stats.confirmed} tx`} />
        <Tile label="clicks per tx" value={stats.confirmed ? (stats.clicks / Math.max(1, stats.confirmed)).toFixed(1) : '—'} />
      </div>
      <div className="spark-wrap">
        <div className="spark-head">
          <span className="muted small">confirmation latency, last {Math.min(lat.length, 60) || 0} tx</span>
        </div>
        <Sparkline values={lat} />
      </div>
    </section>
  )
}

/** Single-series sparkline: 2px line, faint area, last point marked, hover crosshair + tooltip. */
export function Sparkline({ values }: { values: number[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 320
  const H = 64
  const padX = 4
  const padY = 8
  if (values.length < 2) {
    return (
      <div className="spark spark-empty" aria-hidden="true">
        <span className="muted small">{values.length === 1 ? `${formatMs(values[0]!)} — need one more for a line` : 'waiting for confirmations…'}</span>
      </div>
    )
  }
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = Math.max(1, max - min)
  const xs = values.map((_, i) => padX + (i / (values.length - 1)) * (W - padX * 2))
  const ys = values.map((v) => H - padY - ((v - min) / range) * (H - padY * 2))
  const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i]!.toFixed(1)}`).join(' ')
  const area = `${path} L${xs[xs.length - 1]!.toFixed(1)},${H} L${xs[0]!.toFixed(1)},${H} Z`
  const h = hover
  const label = `Latency of the last ${values.length} confirmations, ${formatMs(min)} to ${formatMs(max)}`

  return (
    <div className="spark">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          let best = 0
          for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i]! - px) < Math.abs(xs[best]! - px)) best = i
          setHover(best)
        }}
        onMouseLeave={() => setHover(null)}
      >
        <title>{label}</title>
        <path d={area} className="spark-area" />
        <path d={path} className="spark-line" vectorEffect="non-scaling-stroke" />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" className="spark-dot" />
        {h !== null && (
          <>
            <line x1={xs[h]} x2={xs[h]} y1="0" y2={H} className="spark-cross" vectorEffect="non-scaling-stroke" />
            <circle cx={xs[h]} cy={ys[h]} r="4" className="spark-dot spark-dot-hover" />
          </>
        )}
      </svg>
      <div className="spark-tip" aria-live="polite">
        {h !== null ? `tx ${h + 1}: ${formatMs(values[h]!)}` : `min ${formatMs(min)} · max ${formatMs(max)}`}
      </div>
    </div>
  )
}
