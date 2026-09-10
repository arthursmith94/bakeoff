// Headless smoke test for the shared client module (src/lib/bakeoff.ts) — the exact code the UI uses.
// Usage: bun scripts/smoke.ts [RPC_URL] [KEYPAIR_PATH]
import * as anchor from '@coral-xyz/anchor'
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import fs from 'node:fs'
import { BakeoffClient, type TxSigner } from '../src/lib/bakeoff'
import { classifyError } from '../src/lib/errors'
import { MAX_BAKE, upgradeCostLamports } from '../src/lib/config'
import { formatCook, shortAddr } from '../src/lib/format'

const RPC = process.argv[2] ?? process.env.VITE_RPC_URL ?? 'http://127.0.0.1:8899'
const KEYPAIR = process.argv[3] ?? `${process.env.HOME}/agent-workspace/wallets/deployer.json`

const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR, 'utf8'))))
const wallet = new anchor.Wallet(kp)
// anchor.Wallet already has the TxSigner shape (publicKey + signTransaction).
const signer: TxSigner = wallet
const connection = new Connection(RPC, 'confirmed')
const client = new BakeoffClient(connection)

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assertion failed: ${msg}`)
}

async function main() {
  console.log(`rpc=${RPC} program=${client.programId.toBase58()} wallet=${kp.publicKey.toBase58()}`)
  const bal = await connection.getBalance(kp.publicKey)
  console.log(`balance ${bal / LAMPORTS_PER_SOL} COOK`)
  assert(bal > 0, 'wallet needs funds')

  const before = await client.fetchPlayer(kp.publicKey)
  const needs = await client.setupNeeds(kp.publicKey)
  console.log('setup needs', needs, 'player before', before ? { cookies: before.cookies, level: before.ovenLevel } : null)

  // 1) bake(n) — includes init_global/init_player if this is a fresh wallet on a fresh validator.
  const n = Math.min(MAX_BAKE, 7)
  const tx = await client.buildBakeTx(kp.publicKey, n, needs)
  const r = await client.sendAndConfirm(tx, signer, { onSigned: (s) => console.log(`  sent ${s.slice(0, 16)}…`) })
  console.log(`  ✓ bake(${n}) confirmed slot=${r.slot} latency=${Math.round(r.latencyMs)}ms sign=${Math.round(r.signMs)}ms`)

  const after = await client.fetchPlayer(kp.publicKey)
  assert(after, 'player account must exist after bake')
  const expectedDelta = BigInt(n) * BigInt(after.multiplier)
  const delta = after.cookies - (before?.cookies ?? 0n)
  assert(delta === expectedDelta, `cookies delta ${delta} != ${expectedDelta}`)
  assert(after.bakes - (before?.bakes ?? 0n) === BigInt(n), 'bakes delta')
  console.log(`  ✓ player ${shortAddr(after.address.toBase58())} cookies=${after.cookies} bakes=${after.bakes} level=${after.ovenLevel} x${after.multiplier}`)

  // 2) error classification path: bake(26) must be rejected client-side, and a doctored bake must fail preflight.
  try {
    await client.buildBakeTx(kp.publicKey, MAX_BAKE + 1)
    assert(false, 'bake(26) should throw')
  } catch (e) {
    assert(e instanceof RangeError, 'RangeError expected')
    console.log('  ✓ bake(26) rejected client-side')
  }
  {
    // A fresh, unfunded wallet tries to bake → preflight fails → must classify as insufficient funds.
    const broke = Keypair.generate()
    const brokeSigner: TxSigner = new anchor.Wallet(broke)
    let classified = null
    try {
      const bad = await client.buildBakeTx(broke.publicKey, 1, { needsPlayer: true })
      await client.sendAndConfirm(bad, brokeSigner)
    } catch (e) {
      classified = classifyError(e)
    }
    assert(classified, 'unfunded bake should fail')
    console.log(`  ✓ unfunded bake classified as kind=${classified.kind}: ${classified.title} — ${classified.detail.slice(0, 70)}`)
    assert(classified.kind === 'insufficient-funds', 'expected insufficient-funds classification')
    assert(classified.needsFunds, 'needsFunds flag should be set')
  }

  // 3) global + leaderboard reads.
  const g = await client.fetchGlobal()
  assert(g, 'global must exist')
  console.log(`  ✓ global bakes=${g.totalBakes} cookies=${g.totalCookies} players=${g.totalPlayers} jar=${formatCook(g.totalJarLamports)} COOK`)
  const board = await client.fetchLeaderboard()
  assert(board.length >= 1, 'leaderboard non-empty')
  assert(board.some((p) => p.owner.equals(kp.publicKey)), 'we are on the leaderboard')
  for (let i = 0; i < board.length; i++) {
    if (i > 0) assert(board[i - 1]!.cookies >= board[i]!.cookies, 'sorted desc')
  }
  console.log(`  ✓ leaderboard ${board.length} players; #1 ${shortAddr(board[0]!.owner.toBase58())} with ${board[0]!.cookies} cookies`)
  console.log(`  next upgrade for us: ${formatCook(upgradeCostLamports(after.ovenLevel))} COOK`)
  console.log('SMOKE OK')
}

main().catch((e) => {
  console.error('SMOKE FAILED', e)
  process.exit(1)
})
