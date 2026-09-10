import { useCallback, useEffect, useState } from 'react'
import type { Connection, PublicKey } from '@solana/web3.js'

export function useBalance(connection: Connection, publicKey: PublicKey | null) {
  const [balance, setBalance] = useState<number | null>(null)
  const key = publicKey?.toBase58() ?? null

  const refresh = useCallback(async () => {
    if (!publicKey) return
    try {
      const b = await connection.getBalance(publicKey, 'confirmed')
      setBalance(b)
    } catch {
      /* keep last known balance */
    }
  }, [connection, publicKey])

  useEffect(() => {
    if (!publicKey) {
      setBalance(null)
      return
    }
    void refresh()
    let subId: number | null = null
    try {
      subId = connection.onAccountChange(publicKey, (info) => setBalance(info.lamports), 'confirmed')
    } catch {
      subId = null
    }
    const timer = setInterval(() => void refresh(), 15000)
    return () => {
      clearInterval(timer)
      if (subId !== null) void connection.removeAccountChangeListener(subId).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, key, refresh])

  return { balance, refresh }
}
