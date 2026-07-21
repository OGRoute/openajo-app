"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getReputation, type Reputation } from "@openajo/sdk";
import { chainConfig } from "../../../lib/chain";
import { apiGet, type CircleRow } from "../../../lib/api";

interface MemberProfile {
  memberships: Array<{ circleId: number; received: boolean; defaulted: boolean; circle: CircleRow }>;
}

export default function Profile() {
  const params = useParams<{ address: string }>();
  const address = params.address;
  const [rep, setRep] = useState<Reputation | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReputation(chainConfig(), address)
      .then(setRep)
      .catch((e) => setError((e as Error).message));
    apiGet<MemberProfile>(`/members/${address}`)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [address]);

  return (
    <>
      <h1>Member</h1>
      <p className="muted" style={{ wordBreak: "break-all" }}>{address}</p>

      <h2>On-chain reputation</h2>
      {error && <p className="err">{error}</p>}
      {rep && (
        <div className="row">
          <div className="card">
            <strong className="ok">{rep.completed}</strong>
            <div className="muted">circles completed</div>
          </div>
          <div className="card">
            <strong className={rep.defaulted > 0 ? "err" : undefined}>{rep.defaulted}</strong>
            <div className="muted">defaults</div>
          </div>
        </div>
      )}
      <p className="muted">
        Raw counts read live from the reputation contract — no invented score.
      </p>

      <h2>Circles</h2>
      {!profile || profile.memberships.length === 0 ? (
        <p className="muted">No indexed memberships.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Circle</th><th>Status</th><th>Outcome</th></tr>
          </thead>
          <tbody>
            {profile.memberships.map((m) => (
              <tr key={m.circleId}>
                <td><Link href={`/circles/${m.circleId}`}>#{m.circleId}</Link></td>
                <td className="muted">{m.circle.status}</td>
                <td>
                  {m.defaulted ? (
                    <span className="err">defaulted</span>
                  ) : m.received ? (
                    <span className="ok">received payout</span>
                  ) : (
                    <span className="muted">in rotation</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
