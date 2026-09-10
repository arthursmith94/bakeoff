# 🍪 Bakeoff — an on-chain cookie clicker on Cookie Chain

Every batch of clicks is a **real Cookie Chain transaction**. Oven upgrades are paid in **COOK** straight
into the community **Cookie Jar** (multisig Vault 1), so playing the game funds Cookie Chain builders.
Built for the Superteam Earn *"Create an App on Cookie Chain"* bounty to show off what the chain is good at:
sub-second finality and near-zero fees.

**Live app:** _(deployed URL here)_ · **Program:** [`6GcyLhDfzZBHNpkiBaiWQbXamVoaGK9dcMxHh5DtcjQB`](https://cookiescan.io/account/6GcyLhDfzZBHNpkiBaiWQbXamVoaGK9dcMxHh5DtcjQB) · **Cookie Jar:** [`568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe`](https://cookiescan.io/account/568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe)

## What it does
- **Connect Nightly** — auto-switches your wallet to the Cookie Chain network (via `changeNetwork` + genesis hash).
- **Click to bake** — clicks are batched (25 or every 1.5 s) into one `bake` transaction so you feel the speed without spamming.
- **Upgrade your oven** — each level multiplies cookies-per-click (Fibonacci curve) and transfers COOK to the Cookie Jar. Insufficient COOK? A "Bridge COOK" link points to the Hyperlane bridge.
- **Global leaderboard** — read straight from on-chain `Player` accounts via `getProgramAccounts`.
- **Live chain stats** — current slot, TPS, total bakes, bakers, and COOK donated to the Jar.
- **Real feedback** — every tx shows pending → confirmed with an explorer link, and errors (wrong network, rejected, insufficient funds) are surfaced clearly.

## Required bounty features → where
| Requirement | Implementation |
|---|---|
| Wallet connection (Nightly) | `src/useNightly.ts` |
| Display connected address | header pill → account explorer |
| Transaction execution | `bake`, `upgrade_oven`, `init_player` (`src/game.ts`) |
| Confirmation handling | `confirmTransaction` + toasts (`src/App.tsx`) |
| Error handling / user feedback | try/catch → error toasts; network + balance guards |
| App-specific data & analytics | leaderboard + global stats bar |
| Use existing Cookie Chain programs | System program transfers to the community Cookie Jar vault |

## Architecture
- **Program:** Anchor 0.31 / Rust (`programs/bakeoff`). PDAs: `Global` (`["global"]`) and `Player` (`["player", owner]`). Instructions: `init_global`, `init_player`, `bake(n)`, `upgrade_oven`. No admin keys; the Cookie Jar address is a hard-coded constant checked on-chain. Overflow-checked, saturating arithmetic, events emitted.
- **Frontend:** Vite + React + TypeScript, `@solana/web3.js` + `@coral-xyz/anchor`, direct Nightly injected provider. RPC `https://rpc.cookiescan.io`.

## Run locally
```bash
# program (needs the Solana/Agave toolchain + Anchor 0.31)
cd programs/.. && cargo build-sbf
# frontend
cd app && pnpm i && pnpm dev
```
See `../DESIGN.md` for the full design and `../bakeoff` for the program. End-to-end test: `app/scripts/e2e.ts` (run against `solana-test-validator`).

## Deploy
```bash
solana program deploy programs/bakeoff/target/deploy/bakeoff.so \
  --program-id programs/bakeoff/target/deploy/bakeoff-keypair.json -u https://rpc.cookiescan.io
```
Requires a little COOK for rent/fees (deploy ≈ a few cents per the docs).

## License
MIT.
