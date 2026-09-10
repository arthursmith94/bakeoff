// Shared Bakeoff client. Used by the React app AND by scripts/smoke.ts (bun), so it must not touch
// `window`, `import.meta.env` or any React API. Signing is delegated to a `TxSigner` — a wallet-adapter
// wallet in the browser, an `anchor.Wallet`/Keypair in scripts.
import { Program, type Idl, type Provider } from '@coral-xyz/anchor'
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  type Commitment,
  type SendOptions,
  type TransactionInstruction,
} from '@solana/web3.js'
import rawIdl from '../idl/bakeoff.json'
import { COOKIE_JAR, MAX_BAKE, PROGRAM_ID } from './config'

export const IDL = rawIdl as unknown as Idl

export interface PlayerAccount {
  address: PublicKey
  owner: PublicKey
  cookies: bigint
  bakes: bigint
  ovenLevel: number
  multiplier: number
  createdSlot: bigint
  lastSlot: bigint
}

export interface GlobalAccount {
  totalBakes: bigint
  totalCookies: bigint
  totalPlayers: bigint
  totalJarLamports: bigint
}

/** Minimal signer abstraction: wallet-adapter `useWallet()` satisfies it, so does `anchor.Wallet`. */
export interface TxSigner {
  publicKey: PublicKey
  signTransaction?: (tx: Transaction) => Promise<Transaction>
  sendTransaction?: (tx: Transaction, connection: Connection, options?: SendOptions) => Promise<string>
}

export interface SendResult {
  signature: string
  slot: number
  /** Wall-clock ms from raw send to confirmation (excludes wallet signing time). */
  latencyMs: number
  /** Wall-clock ms spent waiting for the wallet to sign. */
  signMs: number
}

export interface SendCallbacks {
  onSigned?: (signature: string) => void
  commitment?: Commitment
}

/** Thrown when the transaction landed on-chain but the runtime reported an error. */
export class OnChainError extends Error {
  readonly signature: string
  readonly err: unknown
  readonly logs: string[] | null
  constructor(signature: string, err: unknown, logs: string[] | null) {
    super(`Transaction ${signature} failed on-chain: ${JSON.stringify(err)}`)
    this.name = 'OnChainError'
    this.signature = signature
    this.err = err
    this.logs = logs
  }
}

/** Loosely-typed view of anchor's account namespace (the IDL is loaded as plain JSON, not a generated type). */
interface AccountClientLike {
  fetchNullable(address: PublicKey): Promise<Record<string, unknown> | null>
  all(): Promise<{ publicKey: PublicKey; account: Record<string, unknown> }[]>
}

type AnyBn = { toString(): string }
const big = (v: AnyBn | number | bigint) => BigInt(v.toString())

export class BakeoffClient {
  readonly connection: Connection
  readonly programId: PublicKey
  readonly program: Program
  readonly globalPda: PublicKey
  readonly cookieJar: PublicKey
  private readonly accounts: Record<string, AccountClientLike>

  constructor(connection: Connection, programId: string | PublicKey = PROGRAM_ID) {
    this.connection = connection
    this.programId = new PublicKey(programId)
    // Read-only provider: we only ever call `.instruction()` / `.fetch()`, never `.rpc()`.
    const provider: Provider = { connection }
    this.program = new Program({ ...IDL, address: this.programId.toBase58() }, provider)
    this.globalPda = PublicKey.findProgramAddressSync([Buffer.from('global')], this.programId)[0]
    this.cookieJar = new PublicKey(COOKIE_JAR)
    this.accounts = this.program.account as unknown as Record<string, AccountClientLike>
  }

  playerPda(owner: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from('player'), owner.toBuffer()], this.programId)[0]
  }

  // ---------- reads ----------

  async accountExists(pk: PublicKey): Promise<boolean> {
    return (await this.connection.getAccountInfo(pk, 'confirmed')) !== null
  }

  async fetchGlobal(): Promise<GlobalAccount | null> {
    const g = await this.accounts['global']!.fetchNullable(this.globalPda)
    return g ? decodeGlobal(g) : null
  }

  async fetchPlayer(owner: PublicKey): Promise<PlayerAccount | null> {
    const pda = this.playerPda(owner)
    const p = await this.accounts['player']!.fetchNullable(pda)
    return p ? decodePlayer(pda, p) : null
  }

  /** All Player accounts, sorted by cookies desc (ties: more bakes first). */
  async fetchLeaderboard(): Promise<PlayerAccount[]> {
    const all = await this.accounts['player']!.all()
    return all
      .map((a) => decodePlayer(a.publicKey, a.account))
      .sort((a, b) => (a.cookies === b.cookies ? Number(b.bakes - a.bakes) : b.cookies > a.cookies ? 1 : -1))
  }

  // ---------- instructions ----------

  initGlobalIx(payer: PublicKey): Promise<TransactionInstruction> {
    return this.program.methods
      .initGlobal()
      .accounts({ global: this.globalPda, payer, systemProgram: SystemProgram.programId })
      .instruction()
  }

  initPlayerIx(owner: PublicKey): Promise<TransactionInstruction> {
    return this.program.methods
      .initPlayer()
      .accounts({ player: this.playerPda(owner), global: this.globalPda, owner, systemProgram: SystemProgram.programId })
      .instruction()
  }

  bakeIx(owner: PublicKey, n: number): Promise<TransactionInstruction> {
    if (!Number.isInteger(n) || n < 1 || n > MAX_BAKE) throw new RangeError(`bake count must be 1..${MAX_BAKE}, got ${n}`)
    return this.program.methods
      .bake(n)
      .accounts({ player: this.playerPda(owner), global: this.globalPda, owner })
      .instruction()
  }

  upgradeOvenIx(owner: PublicKey): Promise<TransactionInstruction> {
    return this.program.methods
      .upgradeOven()
      .accounts({
        player: this.playerPda(owner),
        global: this.globalPda,
        owner,
        cookieJar: this.cookieJar,
        systemProgram: SystemProgram.programId,
      })
      .instruction()
  }

  // ---------- transactions ----------

  /**
   * Build a `bake(n)` transaction. Prepends `init_global` / `init_player` when the accounts are missing so a
   * brand-new player's first batch of clicks is a single wallet approval.
   */
  async buildBakeTx(owner: PublicKey, n: number, opts: { needsGlobal?: boolean; needsPlayer?: boolean } = {}): Promise<Transaction> {
    const tx = new Transaction()
    if (opts.needsGlobal) tx.add(await this.initGlobalIx(owner))
    if (opts.needsPlayer) tx.add(await this.initPlayerIx(owner))
    tx.add(await this.bakeIx(owner, n))
    return tx
  }

  async buildUpgradeTx(owner: PublicKey): Promise<Transaction> {
    return new Transaction().add(await this.upgradeOvenIx(owner))
  }

  /** Which setup instructions a bake by `owner` currently needs. */
  async setupNeeds(owner: PublicKey): Promise<{ needsGlobal: boolean; needsPlayer: boolean }> {
    const [g, p] = await this.connection.getMultipleAccountsInfo([this.globalPda, this.playerPda(owner)], 'confirmed')
    return { needsGlobal: g === null, needsPlayer: p === null }
  }

  /**
   * Sign, send and confirm. Prefers `signTransaction` + `sendRawTransaction` (so preflight errors carry logs);
   * falls back to the adapter's `sendTransaction`.
   */
  async sendAndConfirm(tx: Transaction, signer: TxSigner, cb: SendCallbacks = {}): Promise<SendResult> {
    const commitment = cb.commitment ?? 'confirmed'
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash(commitment)
    tx.recentBlockhash = blockhash
    tx.feePayer = signer.publicKey

    const t0 = performance.now()
    let signature: string
    let sentAt: number
    if (signer.signTransaction) {
      const signed = await signer.signTransaction(tx)
      sentAt = performance.now()
      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        preflightCommitment: commitment,
        maxRetries: 3,
      })
    } else if (signer.sendTransaction) {
      sentAt = performance.now()
      signature = await signer.sendTransaction(tx, this.connection, { preflightCommitment: commitment, maxRetries: 3 })
    } else {
      throw new Error('Wallet cannot sign transactions')
    }
    cb.onSigned?.(signature)

    const res = await this.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, commitment)
    const latencyMs = performance.now() - sentAt
    if (res.value.err) {
      const logs = await this.connection
        .getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
        .then((t) => t?.meta?.logMessages ?? null)
        .catch(() => null)
      throw new OnChainError(signature, res.value.err, logs)
    }
    // Exact slot the tx landed in (confirmTransaction's context.slot is the observing slot).
    const status = await this.connection.getSignatureStatus(signature).catch(() => null)
    const slot = status?.value?.slot ?? res.context.slot
    return { signature, slot, latencyMs, signMs: sentAt - t0 }
  }
}

// ---------- decoders ----------

function decodePlayer(address: PublicKey, p: Record<string, unknown>): PlayerAccount {
  return {
    address,
    owner: p['owner'] as PublicKey,
    cookies: big(p['cookies'] as AnyBn),
    bakes: big(p['bakes'] as AnyBn),
    ovenLevel: Number(p['ovenLevel']),
    multiplier: Number(p['multiplier']),
    createdSlot: big(p['createdSlot'] as AnyBn),
    lastSlot: big(p['lastSlot'] as AnyBn),
  }
}

function decodeGlobal(g: Record<string, unknown>): GlobalAccount {
  return {
    totalBakes: big(g['totalBakes'] as AnyBn),
    totalCookies: big(g['totalCookies'] as AnyBn),
    totalPlayers: big(g['totalPlayers'] as AnyBn),
    totalJarLamports: big(g['totalJarLamports'] as AnyBn),
  }
}
