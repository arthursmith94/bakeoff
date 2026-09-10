// Browser-only: reads Vite env vars. Keep this out of lib/bakeoff.ts so the client module works under bun.
import { COOKIE_CHAIN } from './config'

const env = import.meta.env

export const RPC_URL: string = env.VITE_RPC_URL?.trim() || COOKIE_CHAIN.rpc
export const WS_URL: string | undefined = env.VITE_WS_URL?.trim() || (RPC_URL === COOKIE_CHAIN.rpc ? COOKIE_CHAIN.ws : undefined)
export const EXPECTED_GENESIS: string = env.VITE_GENESIS_HASH?.trim() || COOKIE_CHAIN.genesisHash
export const IS_MAINNET_RPC = RPC_URL === COOKIE_CHAIN.rpc
