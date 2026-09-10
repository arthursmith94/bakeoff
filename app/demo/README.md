# Bakeoff — Live Demo (Cookie Chain mainnet)

A Playwright-driven walkthrough of the **live, deployed** Bakeoff app. Every bake and the oven
upgrade shown here are **real transactions on Cookie Chain mainnet**, signed by the deployer wallet
(the current #1 player) and confirmed on-chain — no mocks, no read-only screenshots.

- **Program:** `6GcyLhDfzZBHNpkiBaiWQbXamVoaGK9dcMxHh5DtcjQB`
- **Cookie Jar (public-good vault):** `568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe`
- **RPC:** `https://rpc.cookiescan.io` · **Explorer:** https://cookiescan.io
- **Player wallet (deployer):** `5VsE3yW2BGYk9tgjvdkBw27Lzfvnetbcewxx7G14qu4e`

## Files

| File | What it is |
|------|------------|
| `bakeoff-demo.mp4` | H.264 screen recording of the full flow, 900×562, ~41 s (0.9 MB) |
| `bakeoff-demo.gif` | Optimized GIF of the same flow, 680×425, 12 fps, sped up ~1.7× (6.6 MB, < 8 MB) |
| `recording.webm` | Raw Playwright capture (VP8, 1280×800) — source for the above |
| `screenshots/01..06.png` | Six full-page screenshots at key moments (2560 px wide, deviceScaleFactor 2) |
| `capture.mts` | The Playwright script that produced everything |
| `signatures.json` | All 17 on-chain tx signatures captured during the run |

## What each screenshot shows

1. **01-connected.png** — Wallet connected via the `WalletMultiButton`. Header shows the live chain
   stats (slot / TPS / block time), the deployer balance (**30,182.97 COOK**) and address chip.
2. **02-baking-pending.png** — Mid-bake: clicking the cookie queues clicks that are batched into
   `bake(n)` transactions (up to 25 per signature). The tx feed shows a `bake` **confirming…** while
   earlier batches are already **confirmed** (green ✓, 335–814 ms each).
3. **03-confirmed.png** — Bakes confirmed on-chain; the session panel and leaderboard update from
   live mainnet reads (cookies/bakes climbing).
4. **04-leaderboard.png** — Leaderboard read straight from on-chain `Player` accounts; the deployer
   sits at #1. Global totals come from the `Global` PDA.
5. **05-upgrade.png** — Oven upgraded to **Level 1 (×2 per click)**. Celebration banner
   *"Level 1! Your oven now bakes ×2 per click."* is visible, the `upgrade oven` tx is
   **confirmed in 776 ms**, and **COOK TO COOKIE JAR = 0.05** proves the upgrade cost was
   transferred to the community Cookie Jar by the program.
6. **06-final.png** — Final state: 30 clicks → 30 cookies baked, **17 txs sent / 17 confirmed / 0
   failed**, avg confirmation ~441 ms, oven at L1 ×2, leaderboard updated.

## Real transaction signatures

All 17 are in `signatures.json` and are viewable on the explorer at
`https://cookiescan.io/tx/<sig>`. Sixteen are `bake(n)` batches; the last is the `upgrade_oven`.

**Oven upgrade (transfers 0.05 COOK to the Cookie Jar):**

```
tebyhZhUQvrBbctJX9b9xeSSExwSszBE3wdyTyJofgTLFhj1TFJ48U47RmU4fb1dgKEMUMKWo5534pd79811s3s
```

**Bake batches (sample — full list in signatures.json):**

```
24xavvaJResu5Bz4ts1FKq147k7tERp9TnudfvYaew41m3sWb6R7cyreHtShYezZqSum6vKTrYyw2ir1KkxZrwS2
4zovRB7URPKNh4LXKCV1yZKLUSSzYm99DCRkRLTR1pFxMTBT2MLWhyD6Yx6uZPV28Zgvb2ZPiq5TrxH163XTXMU5
kw8uXtZAS2UsGMFiBen26AVxXvhKfPpBSfy7k73CnN14F1zivNyQ6xLKEVuipGyvitXtPrqmzKAsED831T9bnf1
JkvQtTS8gF2tv1jP4pdMfqaFdNuv2CWPbfTriU76Sf2KVwwhq9DfQqVBRhR8Ss5Hv4EopDYWunLoofqXc5Qy1oj
... (12 more)
```

## How the wallet-signed flow works (the important bit)

The app expects a Wallet-Standard **Nightly** wallet. To demo without a browser extension,
`capture.mts` injects a fake Wallet-Standard "Nightly" via `page.addInitScript`:

- It reports the **deployer public key** as its connected account.
- Its `solana:signTransaction` / `solana:signAndSendTransaction` features delegate signing to a
  Node-side binding (`context.exposeFunction`). **The secret key never enters the browser** — the
  page hands the serialized transaction out to Node, which signs it with the deployer `Keypair`
  (`@solana/web3.js`) and returns the signed bytes.
- The app then submits the signed tx over **its own Cookie Chain RPC connection**, so bakes and the
  upgrade are genuine mainnet transactions and the confirmation UI is real.

This reuses the exact client the UI uses (`src/lib/bakeoff.ts`), mirroring the signing pattern from
`scripts/smoke.ts`.

**Result: the full wallet-signed bake + upgrade flow was demonstrated — not a read-only fallback.**

## Reproduce

```bash
cd work/cookiechain/app
./node_modules/.bin/vite build          # build dist/ (uses .env.local; see note)
PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright bun demo/capture.mts
```

The script serves `dist/` on `http://127.0.0.1:4319`, drives the flow, records video + screenshots,
and prints/saves the tx signatures.

## Notes / limitations

- **WebSocket endpoint:** the default `wss://wss.cookiescan.io` presents a TLS cert for a different
  host (`bakedbazaar.art`), which headless Chromium rejects — this stalled confirmations and caused
  blockhash-expiry retries. A `.env.local` overrides `VITE_WS_URL=wss://rpc.cookiescan.io` (valid
  cert, same node), after which confirmations landed in ~350–800 ms. HTTP RPC is unchanged
  (Cookie Chain mainnet).
- **ffmpeg:** Playwright's bundled ffmpeg (`~/.cache/ms-playwright/ffmpeg-1011`) is a stripped build
  (VP8/PNG only — no GIF or H.264 muxers), so the GIF/MP4 conversions use the system `ffmpeg`
  (n9.0.1). The bundled binary is still what records the raw `recording.webm`.
- **GIF sizing:** to stay under 8 MB the GIF is 680 px wide and sped up ~1.7×. For a full-resolution,
  full-speed view use `bakeoff-demo.mp4` (900 px).
</content>
