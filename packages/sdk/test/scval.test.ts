import { describe, expect, it } from "vitest";
import { formatUnits, parseUnits, scI128, scU32, fromScVal } from "../src/scval.js";
import { decodeEvent } from "../src/events.js";
import { nativeToScVal, Keypair, Address } from "@stellar/stellar-sdk";

describe("scval round-trips", () => {
  it("i128 round-trips", () => {
    expect(fromScVal<bigint>(scI128(12345678901234567890n))).toBe(12345678901234567890n);
  });
  it("u32 round-trips", () => {
    expect(fromScVal<number>(scU32(42))).toBe(42);
  });
});

describe("unit formatting", () => {
  it("formats 7dp", () => {
    expect(formatUnits(12_3456789n)).toBe("12.3456789");
    expect(formatUnits(10_0000000n)).toBe("10");
    expect(formatUnits(1n)).toBe("0.0000001");
  });
  it("parses 7dp", () => {
    expect(parseUnits("12.3456789")).toBe(12_3456789n);
    expect(parseUnits("10")).toBe(10_0000000n);
  });
  it("rejects excess precision", () => {
    expect(() => parseUnits("1.00000001")).toThrow();
  });
});

describe("event decoding", () => {
  const g = () => Keypair.random().publicKey();
  const sym = (s: string) => nativeToScVal(s, { type: "symbol" });

  it("decodes payout", () => {
    const who = g();
    const ev = decodeEvent(
      [sym("circle"), sym("payout")],
      nativeToScVal([
        nativeToScVal(0, { type: "u32" }),
        new Address(who).toScVal(),
        nativeToScVal(300n, { type: "i128" }),
        nativeToScVal(2, { type: "u32" }),
      ]),
    );
    expect(ev).toEqual({ kind: "payout", circleId: 0, recipient: who, amount: 300n, cycle: 2 });
  });

  it("decodes rep events", () => {
    const who = g();
    expect(decodeEvent([sym("rep"), sym("default")], new Address(who).toScVal()))
      .toEqual({ kind: "rep_default", member: who });
  });

  it("ignores foreign events", () => {
    expect(decodeEvent([sym("transfer"), sym("native")], scvNum())).toBeNull();
  });

  function scvNum() {
    return nativeToScVal(1n, { type: "i128" });
  }
});
