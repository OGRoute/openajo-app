import { CIRCLE_ERROR_MESSAGES } from "./types.js";

/** Thrown when a simulation fails with a decoded contract error code. */
export class ContractCallError extends Error {
  constructor(
    public readonly code: number | null,
    message: string,
  ) {
    super(message);
    this.name = "ContractCallError";
  }
}

/**
 * Turn a raw simulation failure into a ContractCallError.
 *
 * Error codes are scoped to the contract that raised them, so the caller must
 * pass the matching message map — the two contracts use overlapping codes for
 * unrelated conditions.
 */
export function decodeContractError(
  raw: string,
  messages: Record<number, string> = CIRCLE_ERROR_MESSAGES,
): ContractCallError {
  // Simulation errors carry `Error(Contract, #N)` for contracterror panics.
  const m = raw.match(/Error\(Contract, #(\d+)\)/);
  if (m) {
    const code = Number(m[1]);
    return new ContractCallError(
      code,
      messages[code] ?? `contract error #${code}`,
    );
  }
  return new ContractCallError(null, raw);
}
