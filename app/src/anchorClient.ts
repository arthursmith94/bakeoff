import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "./idl/bakeoff.json";
import { RPC, PROGRAM_ID, COOKIE_JAR } from "./chain";

export const PID = new PublicKey(PROGRAM_ID);
export const JAR = new PublicKey(COOKIE_JAR);
export const conn = new Connection(RPC, "confirmed");
export const [GLOBAL_PDA] = PublicKey.findProgramAddressSync([Buffer.from("global")], PID);
export const playerPda = (owner: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("player"), owner.toBuffer()], PID)[0];

// Wallet-adapter's signer, wrapped for Anchor.
export function getProgram(wallet: anchor.Wallet) {
  const provider = new anchor.AnchorProvider(conn, wallet, { commitment: "confirmed" });
  return new anchor.Program(idl as anchor.Idl, provider);
}

export const MULTIPLIERS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];
export const BASE_UPGRADE_LAMPORTS = 50_000_000;
export const MAX_LEVEL = 12;
export const upgradeCost = (lvl: number) => BASE_UPGRADE_LAMPORTS * 2 ** lvl;
export const SYS = SystemProgram.programId;
