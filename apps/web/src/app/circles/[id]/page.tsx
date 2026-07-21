"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  contribute,
  cancelCircle,
  formatUnits,
  getCircle,
  getCycleDeadline,
  getMember,
  getMembers,
  joinCircle,
  leaveCircle,
  settleCycle,
  type Circle,
  type MemberState,
} from "@openajo/sdk";
import { chainConfig } from "../../../lib/chain";
import { connectWallet, currentAddress, freighterSigner } from "../../../lib/wallet";
import { apiGet, type EventRow } from "../../../lib/api";

function short(a: string): string {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export default function CircleDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [myState, setMyState] = useState<MemberState | null>(null);
  const [deadline, setDeadline] = useState<bigint | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const config = chainConfig();
    const c = await getCircle(config, id);
    setCircle(c);
    setMembers(await getMembers(config, id));
    if (c.status === "Active") setDeadline(await getCycleDeadline(config, id));
    const addr = await currentAddress();
    setMe(addr);
    if (addr) {
      try {
        setMyState(await getMember(config, id, addr));
      } catch {
        setMyState(null); // not a member
      }
    }
    apiGet<{ events: EventRow[] }>(`/circles/${id}`)
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]));
  }, [id]);

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
  }, [refresh]);

  async function act(label: string, fn: (me: string) => Promise<unknown>) {
    setBusy(label);
    setError(null);
    setMsg(null);
    try {
      const addr = me ?? (await connectWallet());
      await fn(addr);
      setMsg(`${label} confirmed.`);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error && !circle) return <p className="err">{error}</p>;
  if (!circle) return <p className="muted">Loading from chain…</p>;

  const config = chainConfig();
  const sign = freighterSigner();
  const isMember = myState !== null;
  const isCreator = me === circle.creator;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const overdue = deadline !== null && now > deadline;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Circle #{id}</h1>
        <span className="badge">{circle.status}</span>
      </div>
      <p className="muted">
        {formatUnits(circle.contribution)} per cycle · deposit {formatUnits(circle.deposit)} ·{" "}
        {members.length}/{circle.size} members · cycle {circle.currentCycle + 1}
        {deadline !== null && (
          <> · deadline {new Date(Number(deadline) * 1000).toLocaleString()}</>
        )}
      </p>

      {/* Action panel: exactly one primary action per state. */}
      <div className="card row">
        {circle.status === "Open" && !isMember && (
          <button className="primary" disabled={busy !== null}
            onClick={() => act("Join", (addr) => joinCircle(config, id, addr, sign))}>
            {busy === "Join" ? "Confirm in Freighter…" : `Join (deposit ${formatUnits(circle.deposit)})`}
          </button>
        )}
        {circle.status === "Active" && isMember && !myState?.defaulted && (
          <button className="primary" disabled={busy !== null}
            onClick={() => act("Contribute", (addr) => contribute(config, id, addr, sign))}>
            {busy === "Contribute" ? "Confirm in Freighter…" : `Contribute ${formatUnits(circle.contribution)}`}
          </button>
        )}
        {circle.status === "Active" && overdue && (
          <button disabled={busy !== null}
            onClick={() => act("Settle", (addr) => settleCycle(config, id, addr, sign))}>
            {busy === "Settle" ? "Confirm in Freighter…" : "Settle cycle (anyone can)"}
          </button>
        )}
        {circle.status === "Open" && isMember && !isCreator && (
          <button disabled={busy !== null}
            onClick={() => act("Leave", (addr) => leaveCircle(config, id, addr, sign))}>
            Leave &amp; refund deposit
          </button>
        )}
        {circle.status === "Open" && isCreator && (
          <button disabled={busy !== null}
            onClick={() => act("Cancel", (addr) => cancelCircle(config, id, addr, sign))}>
            Cancel circle (refunds everyone)
          </button>
        )}
        {msg && <span className="ok">{msg}</span>}
        {error && <span className="err">{error}</span>}
      </div>

      <h2>Members (payout order)</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Address</th><th>Status</th></tr>
        </thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={m}>
              <td>{i + 1}</td>
              <td><a href={`/u/${m}`}>{short(m)}</a>{m === me ? " (you)" : ""}</td>
              <td className="muted">{m === circle.creator ? "creator" : "member"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Timeline</h2>
      {events.length === 0 ? (
        <p className="muted">No indexed history (indexer offline or catching up).</p>
      ) : (
        <table>
          <thead>
            <tr><th>When</th><th>What</th><th>Who</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.eventId}>
                <td className="muted">{new Date(e.timestamp).toLocaleString()}</td>
                <td>{e.kind}{e.cycle !== null ? ` (cycle ${e.cycle + 1})` : ""}</td>
                <td>{e.member ? short(e.member) : "—"}</td>
                <td>{e.amount ? formatUnits(BigInt(e.amount)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
