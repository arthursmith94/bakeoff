import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import idl from "./idl/bakeoff.json";
import { conn, GLOBAL_PDA, JAR, playerPda, SYS } from "./anchorClient";

// Read-only program for building instructions and decoding accounts.
const readProgram = new anchor.Program(idl as anchor.Idl, { connection: conn } as any);

export type PlayerAcc = { owner: PublicKey; cookies: bigint; bakes: bigint; ovenLevel: number; multiplier: number; createdSlot: bigint; lastSlot: bigint };
export type GlobalAcc = { totalBakes: bigint; totalCookies: bigint; totalPlayers: bigint; totalJarLamports: bigint };

const n = (x: any): bigint => BigInt(x.toString());

export async function fetchGlobal(): Promise<GlobalAcc | null> {
  const a = await (readProgram.account as any).global.fetchNullable(GLOBAL_PDA);
  if (!a) return null;
  return { totalBakes: n(a.totalBakes), totalCookies: n(a.totalCookies), totalPlayers: n(a.totalPlayers), totalJarLamports: n(a.totalJarLamports) };
}

export async function fetchPlayer(owner: PublicKey): Promise<PlayerAcc | null> {
  const a = await (readProgram.account as any).player.fetchNullable(playerPda(owner));
  if (!a) return null;
  return { owner: a.owner, cookies: n(a.cookies), bakes: n(a.bakes), ovenLevel: a.ovenLevel, multiplier: a.multiplier, createdSlot: n(a.createdSlot), lastSlot: n(a.lastSlot) };
}

export async function fetchLeaderboard(): Promise<PlayerAcc[]> {
  const all = await (readProgram.account as any).player.all();
  return all
    .map((x: any) => ({ owner: x.account.owner, cookies: n(x.account.cookies), bakes: n(x.account.bakes), ovenLevel: x.account.ovenLevel, multiplier: x.account.multiplier, createdSlot: n(x.account.createdSlot), lastSlot: n(x.account.lastSlot) }))
    .sort((a: PlayerAcc, b: PlayerAcc) => (b.cookies > a.cookies ? 1 : b.cookies < a.cookies ? -1 : 0));
}

async function ix(name: string, args: any[], accounts: Record<string, PublicKey>): Promise<TransactionInstruction> {
  return await (readProgram.methods as any)[name](...args).accounts(accounts).instruction();
}

export async function buildInitGlobal(owner: PublicKey) {
  return ix("initGlobal", [], { global: GLOBAL_PDA, payer: owner, systemProgram: SYS });
}
export async function buildInitPlayer(owner: PublicKey) {
  return ix("initPlayer", [], { player: playerPda(owner), global: GLOBAL_PDA, owner, systemProgram: SYS });
}
export async function buildBake(owner: PublicKey, count: number) {
  return ix("bake", [count], { player: playerPda(owner), global: GLOBAL_PDA, owner });
}
export async function buildUpgrade(owner: PublicKey) {
  return ix("upgradeOven", [], { player: playerPda(owner), global: GLOBAL_PDA, owner, cookieJar: JAR, systemProgram: SYS });
}

// Assemble a tx with fresh blockhash + fee payer for Nightly to sign & send.
export async function makeTx(owner: PublicKey, ...ixs: TransactionInstruction[]): Promise<Transaction> {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = owner;
  tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;
  return tx;
}

export async function tps(connection: Connection = conn): Promise<number> {
  const s = await connection.getRecentPerformanceSamples(1);
  if (!s.length) return 0;
  return Math.round(s[0].numTransactions / Math.max(1, s[0].samplePeriodSecs));
}
