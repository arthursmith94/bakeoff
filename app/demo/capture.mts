// Polished demo capture of the LIVE Bakeoff app on Cookie Chain mainnet.
//
// Serves the built ./dist locally, injects a fake Wallet-Standard "Nightly" wallet whose
// account is the deployer keypair, and drives Playwright through the full flow. Transaction
// signing happens in THIS Node process (the secret key never enters the page); bakes/upgrades
// are REAL mainnet transactions submitted by the app's own Cookie Chain RPC connection.
//
// Usage: bun demo/capture.mts   (run from the app dir)
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core'
import { Connection, Keypair, Transaction } from '@solana/web3.js'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '..')
const DIST = path.join(APP_DIR, 'dist')
const SHOTS = path.join(__dirname, 'screenshots')
const VIDEO_DIR = path.join(__dirname, 'video')
const CHROME = '/home/ducc/.cache/ms-playwright/chromium-1194/chrome-linux/chrome'
const RPC = 'https://rpc.cookiescan.io'
const KEYPAIR_PATH = process.env.DEPLOYER_KEYPAIR ?? `${process.env.HOME}/agent-workspace/wallets/deployer.json`
const PORT = 4319

fs.mkdirSync(SHOTS, { recursive: true })
fs.mkdirSync(VIDEO_DIR, { recursive: true })

// ---- deployer keypair (stays in Node) ----
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8'))))
const conn = new Connection(RPC, 'confirmed')
const pubkeyB58 = kp.publicKey.toBase58()
const pubkeyBytes = Array.from(kp.publicKey.toBytes())
console.log(`deployer ${pubkeyB58}`)
console.log(`balance ${(await conn.getBalance(kp.publicKey)) / 1e9} COOK`)

const sigs: string[] = []

// ---- static server for ./dist ----
const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json',
}
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent((req.url ?? '/').split('?')[0]!)
  if (rel === '/') rel = '/index.html'
  const file = path.join(DIST, rel)
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // SPA fallback
    const html = fs.readFileSync(path.join(DIST, 'index.html'))
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' })
  res.end(fs.readFileSync(file))
})
await new Promise<void>((r) => server.listen(PORT, r))
console.log(`serving dist on http://127.0.0.1:${PORT}`)

// ---- fake Nightly wallet injected into the page ----
// A minimal Wallet-Standard wallet. signTransaction delegates to a Node-exposed binding so the
// secret key never reaches the browser. The app then submits the signed tx over its own Cookie
// Chain RPC connection => real mainnet transactions.
const injectWallet = ({ b58, bytes }: { b58: string; bytes: number[] }) => {
  const ICON =
    'data:image/svg+xml;base64,' +
    btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#6d4aff"/><circle cx="16" cy="16" r="7" fill="#fff"/></svg>`,
    )
  const publicKey = Uint8Array.from(bytes)
  const CHAINS = ['solana:mainnet', 'solana:devnet', 'solana:testnet', 'solana:localnet']
  const account = {
    address: b58,
    publicKey,
    chains: CHAINS,
    features: ['solana:signAndSendTransaction', 'solana:signTransaction'],
    label: 'Deployer',
    icon: ICON,
  }
  const listeners: Record<string, ((...a: unknown[]) => void)[]> = {}
  const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
  const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

  const wallet = {
    version: '1.0.0' as const,
    name: 'Nightly',
    icon: ICON,
    chains: CHAINS,
    accounts: [account],
    features: {
      'standard:connect': {
        version: '1.0.0',
        async connect() {
          return { accounts: wallet.accounts }
        },
      },
      'standard:disconnect': { version: '1.0.0', async disconnect() {} },
      'standard:events': {
        version: '1.0.0',
        on(event: string, listener: (...a: unknown[]) => void) {
          ;(listeners[event] ||= []).push(listener)
          return () => {
            listeners[event] = (listeners[event] || []).filter((l) => l !== listener)
          }
        },
      },
      'solana:signTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        async signTransaction(...inputs: { transaction: Uint8Array }[]) {
          const out = []
          for (const inp of inputs) {
            const signed = await (window as any).__nodeSignTx(b64(inp.transaction))
            out.push({ signedTransaction: unb64(signed) })
          }
          return out
        },
      },
      'solana:signAndSendTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        async signAndSendTransaction(...inputs: { transaction: Uint8Array }[]) {
          const out = []
          for (const inp of inputs) {
            const sig = await (window as any).__nodeSignAndSend(b64(inp.transaction))
            out.push({ signature: unb64(sig) })
          }
          return out
        },
      },
    },
  }

  const register = () => {
    const evt: any = new Event('wallet-standard:register-wallet')
    evt.detail = ({ register }: { register: (w: unknown) => void }) => register(wallet)
    window.dispatchEvent(evt)
  }
  register()
  window.addEventListener('wallet-standard:app-ready', (e: any) => {
    e.detail?.register?.(wallet)
  })

  // Stub the Nightly extension network-switch API so the app's "switch network" prompt succeeds.
  ;(window as any).nightly = { solana: { changeNetwork: async () => ({}) } }
}

// ---- launch ----
const browser: Browser = await chromium.launch({ headless: true, executablePath: CHROME })
const context: BrowserContext = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 800 } },
})

// Node-side signing bindings (secret key stays here).
await context.exposeFunction('__nodeSignTx', async (b64: string) => {
  const tx = Transaction.from(Buffer.from(b64, 'base64'))
  tx.partialSign(kp)
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64')
})
await context.exposeFunction('__nodeSignAndSend', async (b64: string) => {
  const tx = Transaction.from(Buffer.from(b64, 'base64'))
  tx.partialSign(kp)
  const sig = await conn.sendRawTransaction(tx.serialize())
  return Buffer.from(require('bs58').decode(sig)).toString('base64')
})
await context.addInitScript(injectWallet, { b58: pubkeyB58, bytes: pubkeyBytes })

const page: Page = await context.newPage()
page.on('console', (m) => {
  const t = m.text()
  if (/sent |confirmed|slot|error|fail/i.test(t)) console.log('  [page]', t)
})

const shot = async (name: string) => {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true })
  console.log(`  shot ${name}`)
}
const pause = (ms: number) => page.waitForTimeout(ms)

// Pull any tx signatures currently rendered in the tx feed.
const grabSigs = async () => {
  const found = await page.$$eval('a.sig', (els) => els.map((e) => (e as HTMLElement).getAttribute('title') || (e as HTMLElement).textContent || ''))
  for (const s of found) if (s && s.length > 40 && !sigs.includes(s)) sigs.push(s)
}

try {
  console.log('loading app…')
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
  await pause(2500) // let live chain stats + leaderboard load from mainnet

  // 1) Connect wallet.
  console.log('connecting wallet…')
  const connectBtn = page.locator('.wallet-adapter-button-trigger').first()
  await connectBtn.click()
  await pause(1200)
  // The modal lists detected Wallet-Standard wallets; click "Nightly".
  const nightly = page.locator('.wallet-adapter-modal button', { hasText: 'Nightly' }).first()
  if (await nightly.count()) {
    await nightly.click()
  } else {
    // Fallback: some builds auto-select the only wallet.
    const anyWallet = page.locator('.wallet-adapter-modal-list button').first()
    if (await anyWallet.count()) await anyWallet.click()
  }
  await page.waitForFunction(() => /[1-9A-HJ-NP-Za-km-z]{3,}…|…[1-9A-HJ-NP-Za-km-z]{3,}/.test(document.querySelector('.addr-text')?.textContent || '') || !!document.querySelector('.addr-chip'), { timeout: 20000 }).catch(() => {})
  await pause(2500)
  await shot('01-connected.png')

  // 2) Bake ~30 clicks -> batched real bake tx(s).
  console.log('baking (30 clicks)…')
  const cookie = page.locator('button[aria-label^="Bake a cookie"]').first()
  await cookie.scrollIntoViewIfNeeded()
  for (let i = 0; i < 25; i++) {
    await cookie.click({ delay: 10 })
    await pause(55)
  }
  // At 25 clicks the batch flushes immediately -> pending/sent state.
  await pause(400)
  await shot('02-baking-pending.png')
  // remaining clicks
  for (let i = 0; i < 5; i++) {
    await cookie.click({ delay: 10 })
    await pause(60)
  }
  // Wait for a confirmation to render in the tx feed.
  await page.waitForSelector('.feed-item.status-confirmed', { timeout: 60000 }).catch(() => {})
  await pause(2500)
  await grabSigs()
  await shot('03-confirmed.png')
  console.log(`  sigs so far: ${sigs.length}`)

  // Wait for ALL batches to finish draining (button is no longer "Baking"/busy).
  await page.waitForFunction(() => {
    const btn = document.querySelector('button.btn-primary') as HTMLButtonElement | null
    return !!btn && /Upgrade for/i.test(btn.textContent || '') && !btn.disabled
  }, { timeout: 60000 }).catch(() => {})
  await grabSigs()

  // 3) Leaderboard.
  console.log('leaderboard…')
  const board = page.locator('#board-title')
  await board.scrollIntoViewIfNeeded()
  await pause(1500)
  await shot('04-leaderboard.png')

  // 4) Oven upgrade -> real tx transferring COOK to the Cookie Jar.
  console.log('upgrading oven…')
  const upgrade = page.locator('button.btn-primary').filter({ hasText: /Upgrade for/ }).first()
  await upgrade.scrollIntoViewIfNeeded().catch(() => {})
  await pause(800)
  if (await upgrade.count()) {
    await upgrade.click()
    // celebration banner appears on confirm
    await page.waitForSelector('.celebrate, .feed-item.status-confirmed', { timeout: 60000 }).catch(() => {})
    // Wait specifically for a fresh confirmed upgrade entry.
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('.feed-item.status-confirmed')).some((el) => /upgrade/i.test(el.textContent || ''))
    }, { timeout: 60000 }).catch(() => {})
    await pause(2500)
    await grabSigs()
    await shot('05-upgrade.png')
  } else {
    console.log('  upgrade button not available (maxed or insufficient) — skipping')
    await shot('05-upgrade.png')
  }

  // 5) Final: scroll to top, show updated stats.
  console.log('final…')
  await page.evaluate(() => window.scrollTo({ top: 0 }))
  await pause(2000)
  await grabSigs()
  await shot('06-final.png')

  console.log('\nCaptured signatures:')
  for (const s of sigs) console.log('  ' + s)
} catch (e) {
  console.error('CAPTURE ERROR', e)
  await shot('99-error.png')
} finally {
  const vpath = await page.video()?.path()
  await context.close() // finalizes the video
  await browser.close()
  server.close()
  if (vpath) {
    const dest = path.join(__dirname, 'recording.webm')
    fs.copyFileSync(vpath, dest)
    console.log(`video -> ${dest} (${(fs.statSync(dest).size / 1e6).toFixed(2)} MB)`)
  }
  fs.writeFileSync(path.join(__dirname, 'signatures.json'), JSON.stringify(sigs, null, 2))
  console.log('done')
}
