// The game loop: local click queue → batched `bake(n)` transactions, never losing a click.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PublicKey } from '@solana/web3.js'
import type { BakeoffClient, PlayerAccount, TxSigner } from '../lib/bakeoff'
import { classifyError, type ClassifiedError } from '../lib/errors'
import { FEE_LAMPORTS, FLUSH_MS, MAX_BAKE, PLAYER_RENT_LAMPORTS, multiplierForLevel, upgradeCostLamports } from '../lib/config'

export type TxKind = 'bake' | 'upgrade'
export type TxStatus = 'signing' | 'sent' | 'confirmed' | 'failed'

export interface TxEntry {
  id: number
  kind: TxKind
  /** Clicks in this batch (bake) — the number that gets re-queued on failure. */
  n: number
  status: TxStatus
  signature?: string
  slot?: number
  latencyMs?: number
  signMs?: number
  error?: ClassifiedError
  startedAt: number
  finishedAt?: number
  includesInit?: boolean
  /** Clicks from this failed batch were put back in the queue. */
  requeued?: boolean
  minted?: number
  attempt?: number
}

export interface SessionStats {
  clicks: number
  txsSent: number
  confirmed: number
  failed: number
  latencies: number[]
  cookiesBaked: number
  feesLamports: number
}

const EMPTY_STATS: SessionStats = { clicks: 0, txsSent: 0, confirmed: 0, failed: 0, latencies: [], cookiesBaked: 0, feesLamports: 0 }
/** Cap on unsent clicks while disconnected so a bored visitor can't queue 10 000 txs. */
const OFFLINE_CAP = 100
const MAX_FEED = 40

interface Params {
  client: BakeoffClient
  signer: TxSigner | null
  balance: number | null
  /** Called after any confirmed tx so the app can refresh balance / leaderboard. */
  onConfirmed: (kind: TxKind) => void
}

export function useGame({ client, signer, balance, onConfirmed }: Params) {
  const [pending, setPending] = useState(0)
  const [inFlightN, setInFlightN] = useState(0)
  const [busy, setBusy] = useState<TxKind | null>(null)
  const [txs, setTxs] = useState<TxEntry[]>([])
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS)
  const [player, setPlayer] = useState<PlayerAccount | null>(null)
  const [playerLoaded, setPlayerLoaded] = useState(false)
  const [upgradeError, setUpgradeError] = useState<ClassifiedError | null>(null)
  const [celebration, setCelebration] = useState<{ level: number; multiplier: number; at: number } | null>(null)

  const pendingRef = useRef(0)
  const busyRef = useRef<TxKind | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef(0)
  const signerRef = useRef(signer)
  const balanceRef = useRef(balance)
  const needsRef = useRef<{ needsGlobal: boolean; needsPlayer: boolean } | null>(null)
  const playerRef = useRef<PlayerAccount | null>(null)
  const onConfirmedRef = useRef(onConfirmed)
  signerRef.current = signer
  balanceRef.current = balance
  onConfirmedRef.current = onConfirmed

  const ownerKey = signer?.publicKey.toBase58() ?? null

  const setPendingBoth = (n: number) => {
    pendingRef.current = n
    setPending(n)
  }

  const addTx = (e: TxEntry) => setTxs((t) => [e, ...t].slice(0, MAX_FEED))
  const updateTx = (id: number, patch: Partial<TxEntry>) => setTxs((t) => t.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const refreshPlayer = useCallback(async (owner: PublicKey | null = signerRef.current?.publicKey ?? null) => {
    if (!owner) return
    try {
      const p = await client.fetchPlayer(owner)
      playerRef.current = p
      setPlayer(p)
      if (p) needsRef.current = { needsGlobal: false, needsPlayer: false }
    } catch {
      /* transient */
    } finally {
      setPlayerLoaded(true)
    }
  }, [client])

  // Wallet changed: reset per-wallet state (pending clicks are kept on purpose).
  useEffect(() => {
    needsRef.current = null
    playerRef.current = null
    setPlayer(null)
    setPlayerLoaded(false)
    setUpgradeError(null)
    if (ownerKey) void refreshPlayer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKey, client])

  const currentMultiplier = player?.multiplier ?? multiplierForLevel(0)

  const runTx = useCallback(
    async (kind: TxKind, n: number) => {
      const s = signerRef.current
      if (!s) return
      const owner = s.publicKey
      busyRef.current = kind
      setBusy(kind)
      if (kind === 'bake') setInFlightN(n)
      const id = ++idRef.current
      const startedAt = Date.now()
      let needs = needsRef.current
      try {
        if (!needs) {
          needs = await client.setupNeeds(owner)
          needsRef.current = needs
        }
      } catch (e) {
        needs = { needsGlobal: false, needsPlayer: playerRef.current === null }
        void e
      }
      const includesInit = kind === 'bake' && (needs.needsPlayer || needs.needsGlobal)
      addTx({ id, kind, n, status: 'signing', startedAt, includesInit, attempt: 1 })

      // Pre-flight balance check: fail fast with a friendly message instead of a wallet popup.
      const required =
        FEE_LAMPORTS +
        (includesInit ? PLAYER_RENT_LAMPORTS * (needs.needsGlobal ? 2 : 1) : 0) +
        (kind === 'upgrade' ? upgradeCostLamports(playerRef.current?.ovenLevel ?? 0) : 0)
      const bal = balanceRef.current
      if (bal !== null && bal < required) {
        const error = classifyError(new Error('insufficient lamports for fee'))
        error.detail =
          kind === 'upgrade'
            ? `You need about ${(required / 1e9).toFixed(4)} COOK for this upgrade (+ fee) but have ${(bal / 1e9).toFixed(4)} COOK.`
            : `Baking costs ~${(required / 1e9).toFixed(includesInit ? 4 : 6)} COOK${includesInit ? ' (includes one-time player account rent)' : ' per batch'}; you have ${(bal / 1e9).toFixed(6)} COOK.`
        updateTx(id, { status: 'failed', error, finishedAt: Date.now() })
        setStats((st) => ({ ...st, failed: st.failed + 1 }))
        if (kind === 'upgrade') setUpgradeError(error)
        return
      }

      let lastErr: ClassifiedError | null = null
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (attempt > 1) updateTx(id, { status: 'signing', attempt, signature: undefined })
          const tx = kind === 'bake' ? await client.buildBakeTx(owner, n, needs) : await client.buildUpgradeTx(owner)
          const res = await client.sendAndConfirm(tx, s, {
            onSigned: (signature) => {
              updateTx(id, { status: 'sent', signature })
              setStats((st) => ({ ...st, txsSent: st.txsSent + 1 }))
            },
          })
          needsRef.current = { needsGlobal: false, needsPlayer: false }
          const mult = playerRef.current?.multiplier ?? multiplierForLevel(0)
          const minted = kind === 'bake' ? n * mult : 0
          updateTx(id, { status: 'confirmed', slot: res.slot, latencyMs: res.latencyMs, signMs: res.signMs, minted, finishedAt: Date.now() })
          setStats((st) => ({
            ...st,
            confirmed: st.confirmed + 1,
            latencies: [...st.latencies, res.latencyMs].slice(-60),
            cookiesBaked: st.cookiesBaked + minted,
            feesLamports: st.feesLamports + FEE_LAMPORTS,
          }))
          if (kind === 'upgrade') {
            const prevLevel = playerRef.current?.ovenLevel ?? 0
            setCelebration({ level: prevLevel + 1, multiplier: multiplierForLevel(prevLevel + 1), at: Date.now() })
            setUpgradeError(null)
          }
          await refreshPlayer(owner)
          onConfirmedRef.current(kind)
          lastErr = null
          break
        } catch (e) {
          lastErr = classifyError(e)
          if (lastErr.kind === 'blockhash-expired' && attempt === 1) continue // one silent retry with a fresh blockhash
          break
        }
      }
      if (lastErr) {
        updateTx(id, { status: 'failed', error: lastErr, finishedAt: Date.now() })
        setStats((st) => ({ ...st, failed: st.failed + 1 }))
        if (lastErr.kind === 'program-error' && /max level/i.test(lastErr.detail)) await refreshPlayer(owner)
        if (kind === 'upgrade') setUpgradeError(lastErr)
      }
    },
    [client, refreshPlayer],
  )

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (busyRef.current || !signerRef.current) return
    const n = Math.min(pendingRef.current, MAX_BAKE)
    if (n <= 0) return
    setPendingBoth(pendingRef.current - n)
    try {
      await runTx('bake', n)
    } finally {
      busyRef.current = null
      setBusy(null)
      setInFlightN(0)
      if (pendingRef.current > 0) {
        // Keep draining; a tiny delay lets React paint the confirmation first.
        timerRef.current = setTimeout(() => void flush(), 50)
      }
    }
  }, [runTx])

  const scheduleFlush = useCallback(() => {
    if (!timerRef.current) timerRef.current = setTimeout(() => void flush(), FLUSH_MS)
  }, [flush])

  const click = useCallback(() => {
    if (!signerRef.current && pendingRef.current >= OFFLINE_CAP) return false
    setPendingBoth(pendingRef.current + 1)
    setStats((st) => ({ ...st, clicks: st.clicks + 1 }))
    if (pendingRef.current >= MAX_BAKE) void flush()
    else scheduleFlush()
    return true
  }, [flush, scheduleFlush])

  // When a wallet connects with clicks waiting, send them.
  useEffect(() => {
    if (ownerKey && pendingRef.current > 0) scheduleFlush()
  }, [ownerKey, scheduleFlush])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  // Celebration banner/burst is transient.
  useEffect(() => {
    if (!celebration) return
    const t = setTimeout(() => setCelebration(null), 6000)
    return () => clearTimeout(t)
  }, [celebration])

  const retry = useCallback(
    (id: number) => {
      const entry = txs.find((e) => e.id === id)
      if (!entry || entry.status !== 'failed' || entry.requeued) return
      updateTx(id, { requeued: true })
      if (entry.kind === 'bake') {
        setPendingBoth(pendingRef.current + entry.n)
        void flush()
      } else {
        void upgrade()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txs, flush],
  )

  const retryAll = useCallback(() => {
    const lost = txs.filter((e) => e.kind === 'bake' && e.status === 'failed' && !e.requeued)
    if (lost.length === 0) return
    const ids = new Set(lost.map((e) => e.id))
    setTxs((t) => t.map((e) => (ids.has(e.id) ? { ...e, requeued: true } : e)))
    setPendingBoth(pendingRef.current + lost.reduce((a, e) => a + e.n, 0))
    void flush()
  }, [txs, flush])

  const upgrade = useCallback(async () => {
    if (busyRef.current || !signerRef.current) return
    setUpgradeError(null)
    try {
      await runTx('upgrade', 0)
    } finally {
      busyRef.current = null
      setBusy(null)
      if (pendingRef.current > 0) scheduleFlush()
    }
  }, [runTx, scheduleFlush])

  const lostClicks = useMemo(() => txs.filter((e) => e.kind === 'bake' && e.status === 'failed' && !e.requeued).reduce((a, e) => a + e.n, 0), [txs])

  const optimisticCookies = Number(player?.cookies ?? 0n) + (pending + inFlightN) * currentMultiplier

  return {
    pending,
    inFlightN,
    busy,
    txs,
    stats,
    player,
    playerLoaded,
    upgradeError,
    celebration,
    lostClicks,
    optimisticCookies,
    click,
    flush,
    retry,
    retryAll,
    upgrade,
    refreshPlayer,
    offlineCapReached: !signer && pending >= OFFLINE_CAP,
  }
}
