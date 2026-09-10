import { useCallback, useEffect, useState } from "react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { GENESIS, RPC } from "./chain";

// Minimal Nightly (injected Solana provider) integration.
// Nightly injects window.nightly.solana with connect/signAndSendTransaction/changeNetwork.
type NightlySolana = {
  publicKey?: { toString(): string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  changeNetwork?: (n: { genesisHash: string; url?: string }) => Promise<void>;
  signAndSendTransaction: (tx: Transaction | VersionedTransaction) => Promise<{ signature: string }>;
  on?: (e: string, cb: (...a: any[]) => void) => void;
};

declare global {
  interface Window { nightly?: { solana?: NightlySolana } }
}

export type WalletState = {
  provider: NightlySolana | null;
  pubkey: PublicKey | null;
  connecting: boolean;
  installed: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

export function useNightly(): WalletState {
  const [installed, setInstalled] = useState(false);
  const [provider, setProvider] = useState<NightlySolana | null>(null);
  const [pubkey, setPubkey] = useState<PublicKey | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      if (window.nightly?.solana) {
        setInstalled(true);
        setProvider(window.nightly.solana);
        clearInterval(id);
      } else if (++tries > 20) clearInterval(id);
    }, 150);
    return () => clearInterval(id);
  }, []);

  const connect = useCallback(async () => {
    const p = window.nightly?.solana;
    if (!p) { window.open("https://nightly.app/", "_blank"); return; }
    setConnecting(true);
    try {
      // Point Nightly at Cookie Chain before connecting so txs land on the right network.
      try { await p.changeNetwork?.({ genesisHash: GENESIS, url: RPC }); } catch { /* older Nightly */ }
      const res = await p.connect();
      setProvider(p);
      setPubkey(new PublicKey(res.publicKey.toString()));
    } finally { setConnecting(false); }
  }, []);

  const disconnect = useCallback(async () => {
    try { await provider?.disconnect(); } catch { /* ignore */ }
    setPubkey(null);
  }, [provider]);

  return { provider, pubkey, connecting, installed, connect, disconnect };
}
