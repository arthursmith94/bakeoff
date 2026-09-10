// End-to-end test of the Bakeoff program. Usage: bun scripts/e2e.ts [RPC_URL]
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import fs from "node:fs";
import idl from "../src/idl/bakeoff.json";

const RPC = process.argv[2] ?? "http://127.0.0.1:8899";
const COOKIE_JAR = new PublicKey("568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe");
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(`${process.env.HOME}/agent-workspace/wallets/deployer.json`, "utf8"))));
const conn = new Connection(RPC, "confirmed");
const wallet = new anchor.Wallet(kp);
const provider = new anchor.AnchorProvider(conn, wallet, { commitment: "confirmed" });
const program = new anchor.Program(idl as anchor.Idl, provider);
const pid = program.programId;
const [globalPda] = PublicKey.findProgramAddressSync([Buffer.from("global")], pid);
const [playerPda] = PublicKey.findProgramAddressSync([Buffer.from("player"), kp.publicKey.toBuffer()], pid);

const t = (label: string, start: number) => console.log(`  ✓ ${label} (${Date.now() - start} ms)`);

async function main() {
  console.log("rpc", RPC, "program", pid.toBase58(), "wallet", kp.publicKey.toBase58());
  console.log("balance", (await conn.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL);

  if (!(await conn.getAccountInfo(globalPda))) {
    const s = Date.now();
    await program.methods.initGlobal().accounts({ global: globalPda, payer: kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    t("init_global", s);
  } else console.log("  - global exists");

  if (!(await conn.getAccountInfo(playerPda))) {
    const s = Date.now();
    await program.methods.initPlayer().accounts({ player: playerPda, global: globalPda, owner: kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    t("init_player", s);
  } else console.log("  - player exists");

  for (const n of [1, 25]) {
    const s = Date.now();
    const sig = await program.methods.bake(n).accounts({ player: playerPda, global: globalPda, owner: kp.publicKey }).rpc();
    t(`bake(${n}) ${sig.slice(0, 12)}…`, s);
  }
  try {
    await program.methods.bake(26).accounts({ player: playerPda, global: globalPda, owner: kp.publicKey }).rpc();
    console.log("  ✗ bake(26) should have failed");
  } catch (e: any) { console.log("  ✓ bake(26) rejected:", (e.error?.errorMessage ?? e.message).slice(0, 60)); }

  const jarBefore = await conn.getBalance(COOKIE_JAR);
  const s = Date.now();
  await program.methods.upgradeOven().accounts({ player: playerPda, global: globalPda, owner: kp.publicKey, cookieJar: COOKIE_JAR, systemProgram: SystemProgram.programId }).rpc();
  t("upgrade_oven", s);
  const jarAfter = await conn.getBalance(COOKIE_JAR);
  console.log("  jar delta lamports:", jarAfter - jarBefore);

  try {
    await program.methods.upgradeOven().accounts({ player: playerPda, global: globalPda, owner: kp.publicKey, cookieJar: kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log("  ✗ wrong jar should have failed");
  } catch (e: any) { console.log("  ✓ wrong jar rejected:", (e.error?.errorMessage ?? e.message).slice(0, 60)); }

  const s2 = Date.now();
  await program.methods.bake(10).accounts({ player: playerPda, global: globalPda, owner: kp.publicKey }).rpc();
  t("bake(10) after upgrade", s2);

  const p: any = await program.account.player.fetch(playerPda);
  const g: any = await program.account.global.fetch(globalPda);
  console.log("player", { cookies: p.cookies.toString(), bakes: p.bakes.toString(), level: p.ovenLevel, mult: p.multiplier });
  console.log("global", { bakes: g.totalBakes.toString(), cookies: g.totalCookies.toString(), players: g.totalPlayers.toString(), jar: g.totalJarLamports.toString() });
  const all = await program.account.player.all();
  console.log("leaderboard size", all.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
