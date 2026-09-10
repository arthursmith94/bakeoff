import type { GlobalAccount, PlayerAccount } from '../lib/bakeoff'
import { COOKIE_CHAIN, explorerAddress } from '../lib/config'
import { formatCook, formatInt, shortAddr } from '../lib/format'

interface Props {
  players: PlayerAccount[] | null
  global: GlobalAccount | null
  loading: boolean
  error: string | null
  updatedAt: number | null
  me: string | null
}

export function Leaderboard({ players, global, loading, error, updatedAt, me }: Props) {
  const myRank = me && players ? players.findIndex((p) => p.owner.toBase58() === me) : -1
  const top = players?.slice(0, 50) ?? []
  const mine = myRank >= 50 && players ? players[myRank] : null

  return (
    <section className="card board" aria-labelledby="board-title">
      <div className="card-head">
        <h2 id="board-title">Leaderboard</h2>
        <span className="muted small">
          {loading && !players ? 'loading…' : updatedAt ? `updated ${new Date(updatedAt).toLocaleTimeString()}` : ''}
          {loading && players ? ' · refreshing' : ''}
        </span>
      </div>

      <div className="tiles">
        <Tile label="total bakes" value={global ? formatInt(global.totalBakes) : '—'} />
        <Tile label="cookies baked" value={global ? formatInt(global.totalCookies) : '—'} />
        <Tile label="players" value={global ? formatInt(global.totalPlayers) : '—'} />
        <Tile label={`${COOKIE_CHAIN.symbol} to Cookie Jar`} value={global ? formatCook(global.totalJarLamports, 2) : '—'} />
      </div>

      {error && <p className="err-text small">Could not load leaderboard: {error}</p>}
      {players && players.length === 0 && <p className="muted empty">Nobody has baked yet. Be the first!</p>}
      {top.length > 0 && (
        <div className="table-wrap">
          <table className="board-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">baker</th>
                <th scope="col" className="num">cookies</th>
                <th scope="col" className="num">bakes</th>
                <th scope="col" className="num">oven</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p, i) => (
                <Row key={p.address.toBase58()} p={p} rank={i + 1} me={me} />
              ))}
              {mine && (
                <>
                  <tr className="row-gap">
                    <td colSpan={5}>…</td>
                  </tr>
                  <Row p={mine} rank={myRank + 1} me={me} />
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Row({ p, rank, me }: { p: PlayerAccount; rank: number; me: string | null }) {
  const addr = p.owner.toBase58()
  const isMe = addr === me
  return (
    <tr className={isMe ? 'is-me' : ''}>
      <td className={`rank ${rank <= 3 ? `rank-${rank}` : ''}`}>{rank}</td>
      <td>
        <a href={explorerAddress(addr)} target="_blank" rel="noreferrer" title={addr} className="mono">
          {shortAddr(addr, 5)}
        </a>
        {isMe && <span className="pill pill-ok">you</span>}
      </td>
      <td className="num">{formatInt(p.cookies)}</td>
      <td className="num">{formatInt(p.bakes)}</td>
      <td className="num">
        L{p.ovenLevel} <span className="muted">×{p.multiplier}</span>
      </td>
    </tr>
  )
}

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {sub && <span className="tile-sub">{sub}</span>}
    </div>
  )
}
