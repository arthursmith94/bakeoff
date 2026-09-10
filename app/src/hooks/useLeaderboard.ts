import { useEffect, useState } from 'react'
import type { BakeoffClient, GlobalAccount, PlayerAccount } from '../lib/bakeoff'

export function useLeaderboard(client: BakeoffClient, refreshKey: number, intervalMs = 10_000) {
  const [players, setPlayers] = useState<PlayerAccount[] | null>(null)
  const [global, setGlobal] = useState<GlobalAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [p, g] = await Promise.all([client.fetchLeaderboard(), client.fetchGlobal()])
        if (cancelled) return
        setPlayers(p)
        setGlobal(g)
        setError(null)
        setUpdatedAt(Date.now())
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const t = setInterval(() => void load(), intervalMs)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [client, refreshKey, intervalMs])

  return { players, global, loading, error, updatedAt }
}
