import { useCallback, useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useNightly } from "./useNightly";
import { conn } from "./anchorClient";
import {
  buildBake, buildInitGlobal, buildInitPlayer, buildUpgrade, fetchGlobal, fetchLeaderboard,
  fetchPlayer, makeTx, tps, type GlobalAcc, type PlayerAcc,
} from "./game";
import { MULTIPLIERS, MAX_LEVEL, upgradeCost } from "./anchorClient";
import { BRIDGE, COOKIE_JAR, EXPLORER, PROGRAM_ID, RPC, accUrl, txUrl } from "./chain";

const COOK = (lamports: number | bigint) => (Number(lamports) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 4 });
const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`;
const FLUSH_EVERY = 25;
const FLUSH_MS = 1500;

type Toast = { id: number; kind: "pending" | "ok" | "err"; msg: string; sig?: string };

export default function App() {
  const w = useNightly();
  const [player, setPlayer] = useState<PlayerAcc | null>(null);
  const [global, setGlobal] = useState<GlobalAcc | null>(null);
  const [board, setBoard] = useState<PlayerAcc[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [slot, setSlot] = useState<number>(0);
  const [chainTps, setChainTps] = useState<number>(0);
  const [pending, setPending] = useState(0); // un-flushed local clicks
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pop, setPop] = useState(false);
  const pendingRef = useRef(0);
  const flushTimer = useRef<number | null>(null);
  const owner = w.pubkey;

  const toast = useCallback((kind: Toast["kind"], msg: string, sig?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, msg, sig }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 8000 : 5000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [g, b] = await Promise.all([fetchGlobal(), fetchLeaderboard()]);
      setGlobal(g); setBoard(b);
      if (owner) {
        setPlayer(await fetchPlayer(owner));
        setBalance(await conn.getBalance(owner));
      }
    } catch (e) { /* transient rpc */ }
  }, [owner]);

  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => {
    const id = setInterval(async () => {
      try { setSlot(await conn.getSlot("confirmed")); setChainTps(await tps()); } catch { /* */ }
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Sign & send a tx via Nightly, tracking status as toasts.
  const send = useCallback(async (label: string, build: () => Promise<any>) => {
    if (!owner || !w.provider) return;
    setBusy(label);
    toast("pending", `${label}…`);
    try {
      const ixs = await build();
      const tx = await makeTx(owner, ...(Array.isArray(ixs) ? ixs : [ixs]));
      const { signature } = await w.provider.signAndSendTransaction(tx);
      await conn.confirmTransaction(signature, "confirmed");
      toast("ok", `${label} confirmed`, signature);
      await refresh();
      return signature;
    } catch (e: any) {
      const m = e?.error?.errorMessage ?? e?.message ?? String(e);
      toast("err", `${label} failed: ${m.slice(0, 90)}`);
    } finally { setBusy(null); }
  }, [owner, w.provider, toast, refresh]);

  const ensurePlayer = useCallback(async () => {
    if (!owner) return;
    const g = await fetchGlobal();
    const ixs: any[] = [];
    if (!g) ixs.push(await buildInitGlobal(owner));
    ixs.push(await buildInitPlayer(owner));
    await send("Start baking", async () => ixs);
  }, [owner, send]);

  const flush = useCallback(async () => {
    if (!owner) return;
    const count = Math.min(pendingRef.current, 25);
    if (count < 1) return;
    pendingRef.current -= count; setPending(pendingRef.current);
    await send(`Bake ×${count}`, () => buildBake(owner, count));
  }, [owner, send]);

  const click = useCallback(() => {
    if (!player) return;
    pendingRef.current += 1; setPending(pendingRef.current);
    setPop(true); setTimeout(() => setPop(false), 90);
    if (pendingRef.current >= FLUSH_EVERY) { flush(); return; }
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(flush, FLUSH_MS);
  }, [player, flush]);

  const cost = player ? upgradeCost(player.ovenLevel) : 0;
  const canUpgrade = player && player.ovenLevel < MAX_LEVEL && balance != null && balance >= cost;
  const displayCookies = (player ? Number(player.cookies) : 0) + pending * (player?.multiplier ?? 1);

  return (
    <div className="wrap">
      <header>
        <div className="brand"><span className="logo">🍪</span><div><h1>Bakeoff</h1><p>on-chain cookie clicker · Cookie Chain</p></div></div>
        <div className="wallet">
          {owner ? (
            <>
              <span className="pill">{balance != null ? `${COOK(balance)} COOK` : "…"}</span>
              <a className="pill link" href={accUrl(owner.toBase58())} target="_blank" rel="noreferrer">{short(owner.toBase58())}</a>
              <button className="ghost" onClick={w.disconnect}>Disconnect</button>
            </>
          ) : (
            <button className="primary" onClick={w.connect} disabled={w.connecting}>
              {w.connecting ? "Connecting…" : w.installed ? "Connect Nightly" : "Install Nightly"}
            </button>
          )}
        </div>
      </header>

      <div className="stats">
        <Stat label="Slot" value={slot ? slot.toLocaleString() : "—"} />
        <Stat label="TPS" value={chainTps ? chainTps.toLocaleString() : "—"} />
        <Stat label="Total bakes" value={global ? Number(global.totalBakes).toLocaleString() : "—"} />
        <Stat label="Bakers" value={global ? Number(global.totalPlayers).toLocaleString() : "—"} />
        <Stat label="COOK in Jar (from Bakeoff)" value={global ? COOK(global.totalJarLamports) : "—"} hint="Upgrades donate to the community Cookie Jar" />
      </div>

      <main>
        <section className="game card">
          {!owner && <p className="muted">Connect Nightly to start baking. Every batch of clicks is a real Cookie Chain transaction.</p>}
          {owner && !player && (
            <div className="center">
              <p className="muted">No baker account yet.</p>
              <button className="primary big" onClick={ensurePlayer} disabled={!!busy}>Start baking (1 tx)</button>
            </div>
          )}
          {owner && player && (
            <>
              <div className="counter"><span className="big-num">{displayCookies.toLocaleString()}</span><span className="unit">cookies</span></div>
              <button className={`cookie ${pop ? "pop" : ""}`} onClick={click} aria-label="Bake a cookie">🍪</button>
              <p className="muted small">
                +{player.multiplier}/click · Oven Lv {player.ovenLevel} · {pending > 0 ? `${pending} click${pending > 1 ? "s" : ""} pending → batching to chain…` : "click to bake"}
              </p>
              <div className="oven">
                <div>
                  <strong>Upgrade oven → Lv {player.ovenLevel + 1}</strong>
                  <p className="muted small">
                    {player.ovenLevel < MAX_LEVEL ? <>×{MULTIPLIERS[player.ovenLevel + 1]} cookies/click · costs {COOK(cost)} COOK → Cookie Jar</> : "Max level reached 🎉"}
                  </p>
                </div>
                {player.ovenLevel < MAX_LEVEL && (
                  canUpgrade
                    ? <button className="primary" onClick={() => send("Upgrade oven", () => buildUpgrade(owner))} disabled={!!busy}>Upgrade</button>
                    : <a className="ghost" href={BRIDGE} target="_blank" rel="noreferrer">Need COOK →</a>
                )}
              </div>
            </>
          )}
        </section>

        <section className="board card">
          <h2>Leaderboard</h2>
          <ol>
            {board.slice(0, 15).map((p, i) => {
              const me = owner && p.owner.equals(owner as PublicKey);
              return (
                <li key={p.owner.toBase58()} className={me ? "me" : ""}>
                  <span className="rank">{i + 1}</span>
                  <a href={accUrl(p.owner.toBase58())} target="_blank" rel="noreferrer">{short(p.owner.toBase58())}{me ? " (you)" : ""}</a>
                  <span className="lv">Lv {p.ovenLevel}</span>
                  <span className="score">{Number(p.cookies).toLocaleString()}</span>
                </li>
              );
            })}
            {!board.length && <p className="muted small">No bakers yet — be the first.</p>}
          </ol>
        </section>
      </main>

      <footer>
        <a href={`${EXPLORER}/account/${PROGRAM_ID}`} target="_blank" rel="noreferrer">Program</a>
        <a href={accUrl(COOKIE_JAR)} target="_blank" rel="noreferrer">Cookie Jar</a>
        <a href={BRIDGE} target="_blank" rel="noreferrer">Bridge COOK</a>
        <span className="muted small">RPC {RPC.replace("https://", "")}</span>
      </footer>

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span>{t.msg}</span>
            {t.sig && <a href={txUrl(t.sig)} target="_blank" rel="noreferrer">view</a>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="stat" title={hint}><span className="v">{value}</span><span className="l">{label}</span></div>;
}
