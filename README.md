# 🍪 Bakeoff — an on-chain cookie clicker on Cookie Chain

![Bakeoff demo](app/demo/bakeoff-demo.gif)

*Live on Cookie Chain mainnet. Every click batch and oven upgrade above is a real, confirmed transaction.*

**▶ Play: https://arthursmith94.github.io/bakeoff/**

Bakeoff turns Cookie Chain's sub-second finality and near-zero fees into something you can feel. You click a cookie; each batch of clicks is a **real transaction**. You upgrade your oven to bake more per click, and every upgrade sends COOK straight into the community **Cookie Jar** — so playing the game funds Cookie Chain builders.

## What it does
- **Nightly wallet connect** that auto-switches your wallet to Cookie Chain (via `changeNetwork` + genesis hash).
- **Click-to-bake**, batched (every 1.5s or 25 clicks) into one `bake` transaction so you feel the speed without spamming.
- **Oven upgrades** paid in COOK to the community Cookie Jar (Fibonacci multiplier curve). Out of COOK? A "Bridge COOK" link points to the Hyperlane bridge.
- **On-chain global leaderboard**, read straight from `Player` accounts via `getProgramAccounts`.
- **Live chain stats** — current slot, TPS, block time, total bakes, bakers, and COOK donated to the Jar.
- **Real transaction feedback** — every tx shows pending → confirmed with latency, slot, and a Cookiescan link; failures keep your clicks and offer a retry.

## On-chain
- **Program:** [`6GcyLhDfzZBHNpkiBaiWQbXamVoaGK9dcMxHh5DtcjQB`](https://cookiescan.io/account/6GcyLhDfzZBHNpkiBaiWQbXamVoaGK9dcMxHh5DtcjQB) (deployed to Cookie Chain mainnet)
- **Cookie Jar (community vault):** [`568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe`](https://cookiescan.io/account/568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe)
- No admin keys. The Cookie Jar address is a hard-coded constant checked on-chain, so upgrade payments can't be redirected.

## Architecture
- **Program** (`bakeoff/`) — Anchor 0.31 / Rust. PDAs: `Global` (`["global"]`) and `Player` (`["player", owner]`). Instructions: `init_global`, `init_player`, `bake(n)`, `upgrade_oven`. Overflow-checked, saturating arithmetic, events emitted.
- **Frontend** (`app/`) — Vite + React + TypeScript, `@solana/web3.js` + `@coral-xyz/anchor`, Solana wallet-adapter. RPC `https://rpc.cookiescan.io`.

## Run locally
```bash
# program (needs the Solana/Agave toolchain + Anchor 0.31)
cd bakeoff && cargo build-sbf
# frontend
cd app && pnpm install && pnpm dev
```
End-to-end test against a local validator: `app/scripts/smoke.ts`.

## Demo
`app/demo/` has the full mainnet demo — GIF, video, screenshots, and the real transaction signatures captured during the run (all viewable on Cookiescan).

## License
MIT © Arthur Smith
