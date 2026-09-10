import type { TxEntry } from '../hooks/useGame'
import { COOKIE_CHAIN, explorerTx } from '../lib/config'
import { formatInt, formatMs, shortAddr } from '../lib/format'

interface Props {
  txs: TxEntry[]
  lostClicks: number
  onRetry: (id: number) => void
  onRetryAll: () => void
  onSwitchNetwork?: () => void
}

export function TxFeed({ txs, lostClicks, onRetry, onRetryAll, onSwitchNetwork }: Props) {
  return (
    <section className="card feed" aria-labelledby="feed-title">
      <div className="card-head">
        <h2 id="feed-title">Transactions</h2>
        {lostClicks > 0 && (
          <button type="button" className="btn btn-sm btn-warn" onClick={onRetryAll}>
            Retry {lostClicks} unsent click{lostClicks === 1 ? '' : 's'}
          </button>
        )}
      </div>
      {txs.length === 0 ? (
        <p className="muted empty">No transactions yet. Click the cookie — every batch of up to 25 clicks becomes one <code>bake(n)</code> transaction.</p>
      ) : (
        <ul className="feed-list">
          {txs.map((t) => (
            <li key={t.id} className={`feed-item status-${t.status}`}>
              <span className={`status-icon status-icon-${t.status}`} aria-hidden="true">
                {t.status === 'confirmed' ? '✓' : t.status === 'failed' ? '✕' : ''}
              </span>
              <div className="feed-main">
                <div className="feed-line">
                  <strong>
                    {t.kind === 'bake' ? (
                      <>
                        bake ×{t.n}
                        {t.minted ? <span className="muted"> · +{formatInt(t.minted)} cookies</span> : null}
                      </>
                    ) : (
                      'upgrade oven'
                    )}
                  </strong>
                  {t.includesInit && <span className="pill">+ create player</span>}
                  {t.attempt && t.attempt > 1 && <span className="pill">retry {t.attempt}</span>}
                  <span className="feed-status">
                    {t.status === 'signing' && 'waiting for signature…'}
                    {t.status === 'sent' && 'confirming…'}
                    {t.status === 'confirmed' && (
                      <>
                        confirmed in <b>{formatMs(t.latencyMs ?? 0)}</b> · slot {formatInt(t.slot ?? 0)}
                      </>
                    )}
                    {t.status === 'failed' && <span className="err-text">{t.error?.title ?? 'failed'}</span>}
                  </span>
                </div>
                {t.signature && (
                  <a className="sig" href={explorerTx(t.signature)} target="_blank" rel="noreferrer" title={t.signature}>
                    {shortAddr(t.signature, 8)} ↗
                  </a>
                )}
                {t.status === 'failed' && t.error && (
                  <div className="feed-error">
                    <p>{t.error.detail}</p>
                    <div className="feed-actions">
                      {t.kind === 'bake' && !t.requeued && t.error.retryable && (
                        <button type="button" className="btn btn-sm" onClick={() => onRetry(t.id)}>
                          Retry {t.n} click{t.n === 1 ? '' : 's'}
                        </button>
                      )}
                      {t.kind === 'upgrade' && !t.requeued && t.error.retryable && (
                        <button type="button" className="btn btn-sm" onClick={() => onRetry(t.id)}>
                          Retry upgrade
                        </button>
                      )}
                      {t.requeued && <span className="pill pill-ok">re-queued</span>}
                      {t.error.needsFunds && (
                        <a className="btn btn-sm btn-ghost" href={COOKIE_CHAIN.bridge} target="_blank" rel="noreferrer">
                          Get COOK via bridge ↗
                        </a>
                      )}
                      {(t.error.kind === 'wrong-network' || t.error.kind === 'blockhash-expired') && onSwitchNetwork && (
                        <button type="button" className="btn btn-sm btn-ghost" onClick={onSwitchNetwork}>
                          Switch wallet to Cookie Chain
                        </button>
                      )}
                    </div>
                    {t.error.logs && t.error.logs.length > 0 && (
                      <details>
                        <summary>program logs</summary>
                        <pre>{t.error.logs.join('\n')}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
