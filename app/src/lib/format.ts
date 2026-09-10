import { LAMPORTS_PER_COOK } from './config'

export function shortAddr(addr: string, n = 4): string {
  return addr.length <= n * 2 + 1 ? addr : `${addr.slice(0, n)}…${addr.slice(-n)}`
}

export function formatCook(lamports: number | bigint, maxFrac = 4): string {
  const n = Number(lamports) / LAMPORTS_PER_COOK
  if (n === 0) return '0'
  if (Math.abs(n) < 0.0001) return n.toExponential(2)
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac })
}

export function formatInt(n: number | bigint): string {
  return Number(n).toLocaleString('en-US')
}

export function formatMs(ms: number): string {
  return ms >= 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`
}
