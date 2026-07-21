"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCircle, getTotalCircles, parseUnits } from "@openajo/sdk";
import { chainConfig, TOKEN_ID } from "../../../lib/chain";
import { connectWallet, freighterSigner } from "../../../lib/wallet";

const PERIODS = [
  { label: "Daily", secs: 86_400n },
  { label: "Weekly", secs: 604_800n },
  { label: "Monthly (30d)", secs: 2_592_000n },
];

export default function NewCircle() {
  const router = useRouter();
  const [contribution, setContribution] = useState("10");
  const [deposit, setDeposit] = useState("10");
  const [size, setSize] = useState(3);
  const [period, setPeriod] = useState("604800");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const config = chainConfig();
      const creator = await connectWallet();
      await createCircle(
        config,
        {
          creator,
          token: TOKEN_ID,
          contribution: parseUnits(contribution),
          deposit: parseUnits(deposit),
          size,
          periodSecs: BigInt(period),
        },
        freighterSigner(),
      );
      // The new circle id is total-1 (ids are sequential).
      const total = await getTotalCircles(config);
      router.push(`/circles/${total - 1}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Start a circle</h1>
      <p className="muted">
        You are the first member. Your security deposit is escrowed now; the
        circle activates automatically when it reaches the chosen size.
      </p>
      <form onSubmit={submit} className="card" style={{ display: "grid", gap: 14, maxWidth: 480 }}>
        <label>
          Contribution per cycle (tokens)
          <input value={contribution} onChange={(e) => setContribution(e.target.value)} inputMode="decimal" required />
        </label>
        <label>
          Security deposit (tokens)
          <input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" required />
          <span className="muted">
            Slashed if you miss a contribution. If it can&apos;t cover a miss, you default — permanently recorded on-chain.
          </span>
        </label>
        <label>
          Members
          <input type="number" min={2} max={20} value={size} onChange={(e) => setSize(Number(e.target.value))} required />
        </label>
        <label>
          Cycle length
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => (
              <option key={p.label} value={p.secs.toString()}>{p.label}</option>
            ))}
          </select>
        </label>
        {error && <p className="err">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Confirm in Freighter…" : "Create circle"}
        </button>
      </form>
    </>
  );
}
