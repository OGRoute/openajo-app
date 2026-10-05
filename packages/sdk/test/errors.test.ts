import { describe, expect, it } from "vitest";
import { decodeContractError } from "../src/read.js";
import {
  CIRCLE_ERROR_MESSAGES,
  REPUTATION_ERROR_MESSAGES,
  CircleError,
  ReputationError,
} from "../src/types.js";

const simError = (code: number) =>
  `host invocation failed: HostError: Error(Contract, #${code})`;

describe("contract error decoding", () => {
  it("maps circle codes to circle messages", () => {
    const err = decodeContractError(simError(CircleError.AlreadyPaid));
    expect(err.code).toBe(CircleError.AlreadyPaid);
    expect(err.message).toBe(CIRCLE_ERROR_MESSAGES[CircleError.AlreadyPaid]);
  });

  it("maps reputation codes to reputation messages", () => {
    const err = decodeContractError(
      simError(ReputationError.NotAdmin),
      REPUTATION_ERROR_MESSAGES,
    );
    expect(err.code).toBe(ReputationError.NotAdmin);
    expect(err.message).toBe(
      REPUTATION_ERROR_MESSAGES[ReputationError.NotAdmin],
    );
  });

  // The two contracts reuse code numbers for unrelated conditions, so the
  // caller must pass the right map. Code 3 is NotFound on circle and NotAdmin
  // on reputation; decoding one with the other's map is silently wrong.
  it("does not describe a reputation error as a circle error", () => {
    const code = 3;
    expect(ReputationError.NotAdmin).toBe(code);
    expect(CircleError.NotFound).toBe(code);

    const asReputation = decodeContractError(
      simError(code),
      REPUTATION_ERROR_MESSAGES,
    );
    expect(asReputation.message).toBe(
      REPUTATION_ERROR_MESSAGES[ReputationError.NotAdmin],
    );
    expect(asReputation.message).not.toBe(
      CIRCLE_ERROR_MESSAGES[CircleError.NotFound],
    );
  });

  it("falls back to the bare code when a map has no entry", () => {
    const err = decodeContractError(simError(99));
    expect(err.code).toBe(99);
    expect(err.message).toBe("contract error #99");
  });

  it("passes non-contract failures through with a null code", () => {
    const err = decodeContractError("timeout reaching soroban rpc");
    expect(err.code).toBeNull();
    expect(err.message).toBe("timeout reaching soroban rpc");
  });

  it("every contract error code has a message", () => {
    for (const code of Object.values(CircleError)) {
      if (typeof code === "number") {
        expect(CIRCLE_ERROR_MESSAGES[code], `circle #${code}`).toBeTruthy();
      }
    }
    for (const code of Object.values(ReputationError)) {
      if (typeof code === "number") {
        expect(
          REPUTATION_ERROR_MESSAGES[code],
          `reputation #${code}`,
        ).toBeTruthy();
      }
    }
  });
});
