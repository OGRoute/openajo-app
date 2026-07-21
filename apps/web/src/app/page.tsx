"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatUnits } from "@openajo/sdk";
import { apiGet, type Stats } from "../lib/api";

export default function Landing() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiGet<Stats>("/stats").then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <>
      <h1>Rotating savings, without the runaway collector</h1>
      <p>
        Ajo, esusu, adashe — Nigeria runs on rotating savings circles, and every
        circle runs on trust in one collector. OpenAjo replaces the collector
        with a Soroban smart contract on Stellar: contributions are escrowed
        on-chain, payout order is enforced by code, missed payments are slashed
        from a security deposit, and every default is recorded permanently in an
        on-chain reputation registry.
      </p>
      <div className="row">
        <Link href="/circles/new"><button className="primary">Start a circle</button></Link>
        <Link href="/circles"><button>Browse circles</button></Link>
      </div>

      <h2>Protocol stats</h2>
      {stats ? (
        <div className="grid">
          <div className="card"><strong>{stats.circles}</strong><div className="muted">circles created</div></div>
          <div className="card"><strong>{stats.active}</strong><div className="muted">active now</div></div>
          <div className="card"><strong>{stats.completed}</strong><div className="muted">completed</div></div>
          <div className="card"><strong>{formatUnits(BigInt(stats.paidOut))}</strong><div className="muted">paid out (tokens)</div></div>
        </div>
      ) : (
        <p className="muted">Indexer offline — stats unavailable. On-chain circles still work.</p>
      )}

      <h2>How it works</h2>
      <ol>
        <li>Someone starts a circle: token, contribution per cycle, security deposit, group size, cycle length.</li>
        <li>Members join by escrowing the deposit. When the circle is full it activates automatically.</li>
        <li>Each cycle everyone contributes; the whole pot pays out to the next member in join order.</li>
        <li>Miss a payment and the shortfall is slashed from your deposit. If your deposit can&apos;t cover it, you default: skipped in rotation, recorded on-chain, visible to every future circle.</li>
        <li>When everyone has been paid once, remaining deposits are refunded and completions are recorded to your reputation.</li>
      </ol>
    </>
  );
}
