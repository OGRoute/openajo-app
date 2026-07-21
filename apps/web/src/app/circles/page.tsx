"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatUnits } from "@openajo/sdk";
import { apiGet, type CircleRow } from "../../lib/api";

export default function CirclesList() {
  const [items, setItems] = useState<CircleRow[] | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = status ? `?status=${status}` : "";
    apiGet<{ items: CircleRow[] }>(`/circles${q}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, [status]);

  return (
    <>
      <h1>Circles</h1>
      <div className="row">
        <label htmlFor="status" className="muted">Filter:</label>
        <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">All</option>
          <option value="Open">Open — joinable</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>
      {error && <p className="err">Indexer unavailable: {error}</p>}
      {items && items.length === 0 && <p className="muted">No circles yet — start the first one.</p>}
      <div className="grid" style={{ marginTop: 16 }}>
        {(items ?? []).map((c) => (
          <Link key={c.id} href={`/circles/${c.id}`} className="card" style={{ display: "block" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Circle #{c.id}</strong>
              <span className="badge">{c.status}</span>
            </div>
            <div className="muted">
              {formatUnits(BigInt(c.contribution))} per cycle · {c.memberCount ?? "?"}/{c.size} members
            </div>
            <div className="muted">deposit {formatUnits(BigInt(c.deposit))}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
