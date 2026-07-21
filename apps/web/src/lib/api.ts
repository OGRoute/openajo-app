import { INDEXER_URL } from "./chain";

/** GET from the indexer REST API; bigints arrive as strings by design. */
export async function apiGet<T>(path: string): Promise<T> {
  if (!INDEXER_URL) throw new Error("indexer not configured");
  const res = await fetch(`${INDEXER_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`indexer ${res.status}`);
  return (await res.json()) as T;
}

export interface CircleRow {
  id: number;
  creator: string;
  token: string;
  contribution: string;
  deposit: string;
  size: number;
  periodSecs: string;
  status: string;
  startedAt: string;
  currentCycle: number;
  memberCount?: number;
}

export interface EventRow {
  eventId: string;
  kind: string;
  member: string | null;
  amount: string | null;
  cycle: number | null;
  txHash: string;
  ledger: number;
  timestamp: string;
}

export interface Stats {
  circles: number;
  active: number;
  completed: number;
  valueLocked: string;
  paidOut: string;
}
