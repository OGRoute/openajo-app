"use client";

import { useEffect, useState } from "react";
import { connectWallet, currentAddress, freighterInstalled } from "../lib/wallet";

function short(a: string): string {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export default function WalletButton() {
  const [installed, setInstalled] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await freighterInstalled();
      if (!alive) return;
      setInstalled(ok);
      if (ok) setAddress(await currentAddress());
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!installed) {
    return (
      <a href="https://freighter.app" target="_blank" rel="noreferrer">
        Install Freighter
      </a>
    );
  }
  if (address) {
    return (
      <a href={`/u/${address}`} className="badge" title={address}>
        {short(address)}
      </a>
    );
  }
  return (
    <button
      className="primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          setAddress(await connectWallet());
        } catch {
          // user rejected — leave state as-is
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
