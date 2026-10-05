import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  ConfigError,
  MIN_PERIOD_SECS,
  assertAddress,
  assertCircleId,
  assertCreateCircleParams,
  isAccountId,
  isContractId,
  validateConfig,
} from "../src/validate.js";
import { ContractCallError } from "../src/errors.js";
import { CircleError, type OpenAjoConfig } from "../src/types.js";

const CIRCLE = "CCLVOHGHDH32GWFAMCEMVHLNJSF6ENVHERYWU2OHUYWWLAOKLVR3HGKS";
const REPUTATION = "CDXPH2PYUTRW7GV57X6CJH3E3JOPROSC23NXPMAXOO3EOBI5UTCB2GTQ";

const config = (over: Partial<OpenAjoConfig> = {}): OpenAjoConfig => ({
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  circleContractId: CIRCLE,
  reputationContractId: REPUTATION,
  readSource: Keypair.random().publicKey(),
  ...over,
});

describe("strkey shapes", () => {
  it("tells accounts and contracts apart", () => {
    expect(isContractId(CIRCLE)).toBe(true);
    expect(isAccountId(CIRCLE)).toBe(false);
    expect(isAccountId(Keypair.random().publicKey())).toBe(true);
    expect(isContractId(Keypair.random().publicKey())).toBe(false);
  });
});

describe("validateConfig", () => {
  it("accepts a well-formed config", () => {
    expect(() => validateConfig(config())).not.toThrow();
  });

  it("rejects an account id where a contract id belongs", () => {
    expect(() =>
      validateConfig(config({ circleContractId: Keypair.random().publicKey() })),
    ).toThrow(ConfigError);
  });

  it("rejects a contract id where the read source belongs", () => {
    expect(() => validateConfig(config({ readSource: CIRCLE }))).toThrow(
      /readSource must be a Stellar account id/,
    );
  });

  // The usual deployment slip: paste one id into both variables, then spend an
  // afternoon reading RPC errors.
  it("rejects the same id used for both contracts", () => {
    expect(() =>
      validateConfig(config({ reputationContractId: CIRCLE })),
    ).toThrow(/same contract/);
  });

  it("rejects an empty passphrase", () => {
    expect(() => validateConfig(config({ networkPassphrase: "  " }))).toThrow(
      /networkPassphrase is empty/,
    );
  });

  it("rejects an rpcUrl that is not an http(s) URL", () => {
    expect(() => validateConfig(config({ rpcUrl: "soroban-testnet" }))).toThrow(
      /not a URL/,
    );
    expect(() =>
      validateConfig(config({ rpcUrl: "ws://soroban-testnet.stellar.org" })),
    ).toThrow(/must be http or https/);
  });

  it("never echoes a secret seed back in the error", () => {
    const secret = Keypair.random().secret();
    try {
      validateConfig(config({ readSource: secret }));
      throw new Error("expected a ConfigError");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as Error).message).not.toContain(secret);
      expect((e as Error).message).toMatch(/secret seed/);
    }
  });
});

describe("assertCircleId", () => {
  it("accepts a u32", () => {
    expect(() => assertCircleId(0)).not.toThrow();
    expect(() => assertCircleId(0xffff_ffff)).not.toThrow();
  });

  it("rejects values a u32 id can never hold", () => {
    for (const bad of [-1, 1.5, 0x1_0000_0000, NaN]) {
      expect(() => assertCircleId(bad), `${bad}`).toThrow(ConfigError);
    }
  });
});

describe("assertAddress", () => {
  it("accepts accounts and contracts, since a member may be either", () => {
    expect(() => assertAddress(Keypair.random().publicKey(), "member")).not.toThrow();
    expect(() => assertAddress(CIRCLE, "member")).not.toThrow();
  });

  it("rejects junk and names the field", () => {
    expect(() => assertAddress("not-an-address", "member")).toThrow(/member must be/);
  });
});

// These mirror create_circle's guards in openajo-contract:
// contribution > 0, deposit >= 0, size >= 2, period_secs >= 3600.
describe("assertCreateCircleParams", () => {
  const params = {
    contribution: 100_0000000n,
    deposit: 150_0000000n,
    size: 3,
    periodSecs: 604800n,
  };

  it("accepts parameters the contract accepts", () => {
    expect(() => assertCreateCircleParams(params)).not.toThrow();
    expect(() =>
      assertCreateCircleParams({ ...params, deposit: 0n, periodSecs: MIN_PERIOD_SECS }),
    ).not.toThrow();
  });

  it("rejects what the contract would reject, with BadParams", () => {
    const cases: Array<[string, Partial<typeof params>]> = [
      ["zero contribution", { contribution: 0n }],
      ["negative contribution", { contribution: -1n }],
      ["negative deposit", { deposit: -1n }],
      ["one member", { size: 1 }],
      ["fractional size", { size: 2.5 }],
      ["period under an hour", { periodSecs: 3599n }],
    ];
    for (const [name, over] of cases) {
      let thrown: unknown;
      try {
        assertCreateCircleParams({ ...params, ...over });
      } catch (e) {
        thrown = e;
      }
      expect(thrown, name).toBeInstanceOf(ContractCallError);
      expect((thrown as ContractCallError).code, name).toBe(CircleError.BadParams);
    }
  });
});
