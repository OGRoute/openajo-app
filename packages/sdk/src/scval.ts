import { Address, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import type { Circle, CircleStatus, MemberState, Reputation } from "./types.js";

export const scAddr = (a: string): xdr.ScVal => new Address(a).toScVal();
export const scI128 = (v: bigint): xdr.ScVal => nativeToScVal(v, { type: "i128" });
export const scU32 = (v: number): xdr.ScVal => nativeToScVal(v, { type: "u32" });
export const scU64 = (v: bigint): xdr.ScVal => nativeToScVal(v, { type: "u64" });

export function fromScVal<T = unknown>(v: xdr.ScVal): T {
  return scValToNative(v) as T;
}

/** Decoded shape of the on-chain Circle struct (snake_case, enum as symbol vec). */
interface RawCircle {
  creator: unknown;
  token: unknown;
  contribution: bigint;
  deposit: bigint;
  size: number;
  period_secs: bigint;
  status: unknown;
  started_at: bigint;
  current_cycle: number;
}

function decodeStatus(raw: unknown): CircleStatus {
  // Unit enum variants decode as [symbolString] (or a bare string on some
  // SDK paths) — normalize both.
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s === "Open" || s === "Active" || s === "Completed" || s === "Cancelled") {
    return s;
  }
  throw new Error(`unknown CircleStatus: ${String(s)}`);
}

export function decodeCircle(v: xdr.ScVal): Circle {
  const raw = fromScVal<RawCircle>(v);
  return {
    creator: String(raw.creator),
    token: String(raw.token),
    contribution: BigInt(raw.contribution),
    deposit: BigInt(raw.deposit),
    size: Number(raw.size),
    periodSecs: BigInt(raw.period_secs),
    status: decodeStatus(raw.status),
    startedAt: BigInt(raw.started_at),
    currentCycle: Number(raw.current_cycle),
  };
}

export function decodeMemberState(v: xdr.ScVal): MemberState {
  const raw = fromScVal<{
    deposit_remaining: bigint;
    received: boolean;
    defaulted: boolean;
  }>(v);
  return {
    depositRemaining: BigInt(raw.deposit_remaining),
    received: raw.received,
    defaulted: raw.defaulted,
  };
}

export function decodeReputation(v: xdr.ScVal): Reputation {
  const raw = fromScVal<{ completed: number; defaulted: number }>(v);
  return { completed: Number(raw.completed), defaulted: Number(raw.defaulted) };
}

/** 7-decimal display helper (SAC assets). Never use floats for math. */
export function formatUnits(raw: bigint, decimals = 7): string {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

/** Parse a decimal string into raw units. Throws on more precision than `decimals`. */
export function parseUnits(text: string, decimals = 7): bigint {
  const t = text.trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) throw new Error(`invalid amount: ${text}`);
  const neg = t.startsWith("-");
  const [wholeRaw, fracRaw = ""] = (neg ? t.slice(1) : t).split(".");
  if (fracRaw.length > decimals) {
    throw new Error(`too many decimal places (max ${decimals}): ${text}`);
  }
  const frac = fracRaw.padEnd(decimals, "0");
  const value = BigInt(wholeRaw) * 10n ** BigInt(decimals) + BigInt(frac || "0");
  return neg ? -value : value;
}
