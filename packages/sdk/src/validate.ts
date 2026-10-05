import { ContractCallError } from "./errors.js";
import { CircleError, type OpenAjoConfig } from "./types.js";

/**
 * Thrown for deployment and wiring mistakes — a malformed contract id, a
 * missing passphrase — as opposed to ContractCallError, which means the chain
 * rejected an otherwise well-formed call.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Stellar strkeys: 56 chars of base32, prefixed by type. */
const CONTRACT_ID = /^C[A-Z2-7]{55}$/;
const ACCOUNT_ID = /^G[A-Z2-7]{55}$/;
const SECRET_SEED = /^S[A-Z2-7]{55}$/;

export const isContractId = (v: string): boolean => CONTRACT_ID.test(v);
export const isAccountId = (v: string): boolean => ACCOUNT_ID.test(v);

/** u32 is the contract's id type; ids outside it can never exist on-chain. */
const U32_MAX = 0xffff_ffff;

export function assertCircleId(id: number): void {
  if (!Number.isInteger(id) || id < 0 || id > U32_MAX) {
    throw new ConfigError(
      `circle id must be an integer between 0 and ${U32_MAX}, got ${id}`,
    );
  }
}

export function assertAccountId(value: string, field: string): void {
  if (SECRET_SEED.test(value)) {
    // Never echo the value back: it is a key.
    throw new ConfigError(`${field} is a secret seed (S...); pass the public G... address`);
  }
  if (!isAccountId(value)) {
    throw new ConfigError(`${field} must be a Stellar account id (G...), got ${value}`);
  }
}

export function assertContractId(value: string, field: string): void {
  if (!isContractId(value)) {
    throw new ConfigError(`${field} must be a contract id (C...), got ${value}`);
  }
}

/**
 * Soroban `Address` is either an account or a contract, and the contracts take
 * members as plain addresses — so a contract can hold a membership. Accept
 * both, and reject a secret seed outright.
 */
export function assertAddress(value: string, field: string): void {
  if (SECRET_SEED.test(value)) {
    throw new ConfigError(`${field} is a secret seed (S...); pass the public address`);
  }
  if (!isAccountId(value) && !isContractId(value)) {
    throw new ConfigError(
      `${field} must be a Stellar address (G... or C...), got ${value}`,
    );
  }
}

const checked = new WeakSet<object>();

/**
 * Validate the shape of a config once per object.
 *
 * Both the web app and the indexer only check that their environment
 * variables are *present*. A swapped or mistyped id passes that check and then
 * fails deep inside RPC with an opaque error, which is a bad trade for one
 * regex at the edge.
 */
export function validateConfig(config: OpenAjoConfig): void {
  if (checked.has(config)) return;

  assertContractId(config.circleContractId, "circleContractId");
  assertContractId(config.reputationContractId, "reputationContractId");
  assertAccountId(config.readSource, "readSource");

  if (config.circleContractId === config.reputationContractId) {
    throw new ConfigError(
      "circleContractId and reputationContractId are the same contract",
    );
  }

  if (!config.networkPassphrase.trim()) {
    throw new ConfigError("networkPassphrase is empty");
  }

  let url: URL;
  try {
    url = new URL(config.rpcUrl);
  } catch {
    throw new ConfigError(`rpcUrl is not a URL: ${config.rpcUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigError(`rpcUrl must be http or https, got ${url.protocol}`);
  }

  checked.add(config);
}

export interface CreateCircleLimits {
  contribution: bigint;
  deposit: bigint;
  size: number;
  periodSecs: bigint;
}

/** The shortest period the contract accepts, in seconds. */
export const MIN_PERIOD_SECS = 3600n;

/** The smallest circle the contract accepts. */
export const MIN_SIZE = 2;

/**
 * Mirror of `create_circle`'s parameter guards, so a bad form value fails
 * before the user is asked to sign. Errors carry `CircleError.BadParams` — the
 * code the contract itself would panic with — with a message naming the field.
 *
 * Deliberately no upper bound on `size`: the contract has none yet
 * (openajo-contract#1), and the SDK should not invent limits the chain will
 * not enforce.
 */
export function assertCreateCircleParams(p: CreateCircleLimits): void {
  const bad = (message: string) =>
    new ContractCallError(CircleError.BadParams, message);

  if (p.contribution <= 0n) {
    throw bad("Contribution must be greater than zero.");
  }
  if (p.deposit < 0n) {
    throw bad("Deposit cannot be negative.");
  }
  if (!Number.isInteger(p.size) || p.size < MIN_SIZE) {
    throw bad(`A circle needs at least ${MIN_SIZE} members.`);
  }
  if (p.size > U32_MAX) {
    throw bad(`Circle size must be at most ${U32_MAX}.`);
  }
  if (p.periodSecs < MIN_PERIOD_SECS) {
    throw bad("A cycle must be at least one hour long.");
  }
}
