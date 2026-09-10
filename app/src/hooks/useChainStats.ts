import { useEffect, useRef, useState } from 'react'
import type { Connection } from '@solana/web3.js'

export interface ChainStats {
  slot: number | null
  tps: number | null
  /** Average slot (block) time in ms, derived from the latest performance sample. */
  slotTimeMs: number | null
  genesisHash: string | null
  error: string | null
  /** True when the slot updated in the last few seconds (drives the "live" dot). */
  live: boolean
}

export function useChainStats(connection: Connection): ChainStats {
  const [stats, setStats] = useState<ChainStats>({ slot: null, tps: null, slotTimeMs: null, genesisHash: null, error: null, live: false })
  const lastUpdate = useRef(0)

  useEffect(() => {
    let cancelled = false
    const patch = (p: Partial<ChainStats>) => !cancelled && setStats((s) => ({ ...s, ...p }))

    connection
      .getGenesisHash()
      .then((genesisHash) => patch({ genesisHash, error: null }))
      .catch((e: unknown) => patch({ error: e instanceof Error ? e.message : String(e) }))

    // Slot: websocket subscription + polling fallback (max of the two).
    let subId: number | null = null
    try {
      subId = connection.onSlotChange((info) => {
        lastUpdate.current = Date.now()
        setStats((s) => ({ ...s, slot: Math.max(s.slot ?? 0, info.slot), live: true, error: null }))
      })
    } catch {
      subId = null
    }
    const pollSlot = () =>
      connection
        .getSlot('confirmed')
        .then((slot) => {
          lastUpdate.current = Date.now()
          setStats((s) => ({ ...s, slot: Math.max(s.slot ?? 0, slot), live: true, error: null }))
        })
        .catch((e: unknown) => patch({ error: e instanceof Error ? e.message : String(e), live: false }))
    void pollSlot()
    const slotTimer = setInterval(pollSlot, 4000)

    const pollPerf = () =>
      connection
        .getRecentPerformanceSamples(1)
        .then((samples) => {
          const s = samples[0]
          if (!s || s.samplePeriodSecs === 0) return
          const tps = s.numTransactions / s.samplePeriodSecs
          const slotTimeMs = s.numSlots > 0 ? (s.samplePeriodSecs * 1000) / s.numSlots : null
          patch({ tps, slotTimeMs })
        })
        .catch(() => {})
    void pollPerf()
    const perfTimer = setInterval(pollPerf, 5000)

    const liveTimer = setInterval(() => {
      if (Date.now() - lastUpdate.current > 8000) patch({ live: false })
    }, 2000)

    return () => {
      cancelled = true
      clearInterval(slotTimer)
      clearInterval(perfTimer)
      clearInterval(liveTimer)
      if (subId !== null) void connection.removeSlotChangeListener(subId).catch(() => {})
    }
  }, [connection])

  return stats
}
