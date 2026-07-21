import { scValToNative, xdr } from "@stellar/stellar-sdk";

/**
 * Decoded OpenAjo contract events. Shapes mirror the emitters in
 * openajo-contract exactly — the indexer folds these and the topic/data
 * layouts are a compatibility contract between the repos.
 */
export type OpenAjoEvent =
  | { kind: "create"; circleId: number; creator: string }
  | { kind: "join"; circleId: number; member: string }
  | { kind: "start"; circleId: number }
  | { kind: "contrib"; circleId: number; member: string; cycle: number }
  | { kind: "slash"; circleId: number; member: string; amount: bigint }
  | { kind: "default"; circleId: number; member: string }
  | { kind: "payout"; circleId: number; recipient: string; amount: bigint; cycle: number }
  | { kind: "complete"; circleId: number }
  | { kind: "cancel"; circleId: number }
  | { kind: "rep_complete"; member: string }
  | { kind: "rep_default"; member: string };

/**
 * Decode one RPC event's topics + value into an OpenAjoEvent.
 * Returns null for events that aren't ours (e.g. SAC transfer events).
 */
export function decodeEvent(
  topics: xdr.ScVal[],
  value: xdr.ScVal,
): OpenAjoEvent | null {
  if (topics.length !== 2) return null;
  const t0 = scValToNative(topics[0]);
  const t1 = scValToNative(topics[1]);
  if (typeof t0 !== "string" || typeof t1 !== "string") return null;
  const data = scValToNative(value);

  if (t0 === "rep") {
    const member = String(data);
    if (t1 === "complete") return { kind: "rep_complete", member };
    if (t1 === "default") return { kind: "rep_default", member };
    return null;
  }

  if (t0 !== "circle") return null;

  switch (t1) {
    case "create": {
      const [id, creator] = data as [number, unknown];
      return { kind: "create", circleId: Number(id), creator: String(creator) };
    }
    case "join": {
      const [id, member] = data as [number, unknown];
      return { kind: "join", circleId: Number(id), member: String(member) };
    }
    case "start":
      return { kind: "start", circleId: Number(data) };
    case "contrib": {
      const [id, member, cycle] = data as [number, unknown, number];
      return {
        kind: "contrib",
        circleId: Number(id),
        member: String(member),
        cycle: Number(cycle),
      };
    }
    case "slash": {
      const [id, member, amount] = data as [number, unknown, bigint];
      return {
        kind: "slash",
        circleId: Number(id),
        member: String(member),
        amount: BigInt(amount),
      };
    }
    case "default": {
      const [id, member] = data as [number, unknown];
      return { kind: "default", circleId: Number(id), member: String(member) };
    }
    case "payout": {
      const [id, recipient, amount, cycle] = data as [number, unknown, bigint, number];
      return {
        kind: "payout",
        circleId: Number(id),
        recipient: String(recipient),
        amount: BigInt(amount),
        cycle: Number(cycle),
      };
    }
    case "complete":
      return { kind: "complete", circleId: Number(data) };
    case "cancel":
      return { kind: "cancel", circleId: Number(data) };
    default:
      return null;
  }
}
