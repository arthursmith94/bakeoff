// Chain + program constants shared by the UI and the headless smoke test.
// Nothing in here reads the environment; see env.ts for that.

export const COOKIE_CHAIN = {
  name: 'Cookie Chain',
  rpc: 'https://rpc.cookiescan.io',
  ws: 'wss://rpc.cookiescan.io',
  genesisHash: '9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2',
  explorer: 'https://cookiescan.io',
  bridge: 'https://hyperlane.cookiescan.io',
  docs: 'https://docs.cookiechain.wtf',
  symbol: 'COOK',
  decimals: 9,
} as const

export const PROGRAM_ID = '6GcyLhDfzZBHNpkiBaiWQbXamVoaGK9dcMxHh5DtcjQB'
export const COOKIE_JAR = '568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe'
export const GITHUB_URL = 'https://github.com/arthursmith94/bakeoff'

export const LAMPORTS_PER_COOK = 1_000_000_000
/** Base fee per signature on Cookie Chain (same as Solana): 5000 lamports. */
export const FEE_LAMPORTS = 5_000
/** Approximate rent for a Player account (8 + 32 + 8 + 8 + 1 + 2 + 8 + 8 + 1 = 76 bytes). */
export const PLAYER_RENT_LAMPORTS = 1_420_000

/** Game rules — must mirror programs/bakeoff/src/lib.rs. */
export const MAX_BAKE = 25
export const MAX_LEVEL = 12
export const BASE_UPGRADE_LAMPORTS = 50_000_000 // 0.05 COOK
export const MULTIPLIERS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377] as const

/** UI batching: flush pending clicks after this many ms, or when MAX_BAKE clicks are queued. */
export const FLUSH_MS = 1500

export function upgradeCostLamports(level: number): number {
  return BASE_UPGRADE_LAMPORTS * 2 ** level
}

export function multiplierForLevel(level: number): number {
  return MULTIPLIERS[Math.min(level, MAX_LEVEL)] ?? 1
}

export const explorerTx = (sig: string) => `${COOKIE_CHAIN.explorer}/tx/${sig}`
export const explorerAddress = (addr: string) => `${COOKIE_CHAIN.explorer}/address/${addr}`
