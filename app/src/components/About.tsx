import { COOKIE_CHAIN, COOKIE_JAR, GITHUB_URL, MAX_BAKE, PROGRAM_ID, explorerAddress } from '../lib/config'
import { shortAddr } from '../lib/format'
import { CopyIcon } from './Header'

export function About({ onCopy }: { onCopy: (text: string, label: string) => void }) {
  return (
    <section className="card about" id="about" aria-labelledby="about-title">
      <div className="card-head">
        <h2 id="about-title">How it works</h2>
      </div>
      <ol className="steps">
        <li>
          <strong>Connect Nightly</strong> and make sure it is set to {COOKIE_CHAIN.name} (the app asks Nightly to switch automatically).
        </li>
        <li>
          <strong>Click the cookie.</strong> Clicks are batched locally and flushed every 1.5 s or at {MAX_BAKE} clicks as one <code>bake(n)</code> transaction. Your first batch also creates your player account (PDA <code>["player", wallet]</code>) — one signature.
        </li>
        <li>
          <strong>Watch it confirm.</strong> Each tx shows wall-clock latency to confirmation, its slot and a Cookiescan link. Failures never lose clicks: they are re-queued with a retry button.
        </li>
        <li>
          <strong>Upgrade the oven</strong> to bake more cookies per click. The upgrade cost is transferred by the program to the community Cookie Jar — a public-good vault, hard-coded in the program so nobody can redirect it.
        </li>
        <li>
          <strong>Climb the leaderboard.</strong> Rankings are read straight from on-chain <code>Player</code> accounts; global totals from the <code>Global</code> PDA.
        </li>
      </ol>
      <h3>Why Cookie Chain?</h3>
      <p className="muted">
        A clicker only works when the chain is fast and cheap enough that every batch of clicks can be a real transaction. {COOKIE_CHAIN.name} (an SVM chain) confirms in well under a second and charges ~5000 lamports per signature, so the game can be honest: no off-chain
        scorekeeping, every cookie on the ledger, and the whole thing costs pennies to deploy.
      </p>
      <dl className="kv">
        <dt>program</dt>
        <dd>
          <a href={explorerAddress(PROGRAM_ID)} target="_blank" rel="noreferrer" className="mono" title={PROGRAM_ID}>
            {shortAddr(PROGRAM_ID, 6)} ↗
          </a>
          <button type="button" className="icon-btn" onClick={() => onCopy(PROGRAM_ID, 'Program id')} aria-label="Copy program id">
            <CopyIcon />
          </button>
        </dd>
        <dt>Cookie Jar</dt>
        <dd>
          <a href={explorerAddress(COOKIE_JAR)} target="_blank" rel="noreferrer" className="mono" title={COOKIE_JAR}>
            {shortAddr(COOKIE_JAR, 6)} ↗
          </a>
          <button type="button" className="icon-btn" onClick={() => onCopy(COOKIE_JAR, 'Cookie Jar address')} aria-label="Copy Cookie Jar address">
            <CopyIcon />
          </button>
        </dd>
        <dt>source</dt>
        <dd>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </dd>
        <dt>docs</dt>
        <dd>
          <a href={COOKIE_CHAIN.docs} target="_blank" rel="noreferrer">
            docs.cookiechain.wtf ↗
          </a>
        </dd>
      </dl>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <span>Bakeoff · built for the Cookie Chain bounty · no admin keys, no off-chain state</span>
      <nav aria-label="Footer links">
        <a href={explorerAddress(PROGRAM_ID)} target="_blank" rel="noreferrer">
          program
        </a>
        <a href={explorerAddress(COOKIE_JAR)} target="_blank" rel="noreferrer">
          Cookie Jar
        </a>
        <a href={COOKIE_CHAIN.bridge} target="_blank" rel="noreferrer">
          bridge COOK
        </a>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={COOKIE_CHAIN.docs} target="_blank" rel="noreferrer">
          docs
        </a>
      </nav>
    </footer>
  )
}
