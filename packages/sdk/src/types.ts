/** Mirrors of the on-chain types in openajo-contract. */

export type CircleStatus = "Open" | "Active" | "Completed" | "Cancelled";

export interface Circle {
  creator: string; // G...
  token: string; // C... (SAC)
  contribution: bigint; // raw token units (7 dp for USDC/XLM SACs)
  deposit: bigint;
  size: number; // u32
  periodSecs: bigint; // u64
  status: CircleStatus;
  startedAt: bigint; // 0n until Active
  currentCycle: number; // u32, 0-based
}

export interface MemberState {
  depositRemaining: bigint;
  received: boolean;
  defaulted: boolean;
}

export interface Reputation {
  completed: number; // u32
  defaulted: number; // u32
}

export enum CircleError {
  NotInitialized = 1,
  AlreadyInitialized = 2,
  NotFound = 3,
  BadStatus = 4,
  AlreadyMember = 5,
  NotMember = 6,
  CircleFull = 7,
  AlreadyPaid = 8,
  Defaulted = 9,
  NotDue = 10,
  IsCreator = 11,
  BadParams = 12,
  NotCreator = 13,
}

/**
 * Human messages for `circle` simulation failures, keyed by contract error
 * code. Codes are per-contract: never decode a `reputation` error with this
 * map — use REPUTATION_ERROR_MESSAGES.
 */
export const CIRCLE_ERROR_MESSAGES: Record<number, string> = {
  [CircleError.NotInitialized]: "The circle contract isn't initialized yet.",
  [CircleError.AlreadyInitialized]: "The circle contract is already initialized.",
  [CircleError.NotFound]: "That circle doesn't exist.",
  [CircleError.BadStatus]: "The circle isn't in the right state for that.",
  [CircleError.AlreadyMember]: "You're already a member of this circle.",
  [CircleError.NotMember]: "You're not a member of this circle.",
  [CircleError.CircleFull]: "This circle is already full.",
  [CircleError.AlreadyPaid]: "You've already contributed this cycle.",
  [CircleError.Defaulted]: "This membership has defaulted.",
  [CircleError.NotDue]: "The cycle isn't due to settle yet.",
  [CircleError.IsCreator]: "The creator can't leave — cancel instead.",
  [CircleError.BadParams]: "Invalid circle parameters.",
  [CircleError.NotCreator]: "Only the creator can do that.",
};

export enum ReputationError {
  NotInitialized = 1,
  AlreadyInitialized = 2,
  NotAdmin = 3,
  NotReporter = 4,
}

/**
 * Human messages for `reputation` simulation failures. The codes overlap with
 * CircleError numerically but mean different things — code 3 is NotFound on
 * `circle` and NotAdmin here.
 */
export const REPUTATION_ERROR_MESSAGES: Record<number, string> = {
  [ReputationError.NotInitialized]:
    "The reputation contract isn't initialized yet.",
  [ReputationError.AlreadyInitialized]:
    "The reputation contract is already initialized.",
  [ReputationError.NotAdmin]: "Only the reputation admin can do that.",
  [ReputationError.NotReporter]:
    "That contract isn't an authorized reputation reporter.",
};

/** Network + contract configuration shared by web and indexer. */
export interface OpenAjoConfig {
  rpcUrl: string;
  networkPassphrase: string;
  circleContractId: string;
  reputationContractId: string;
  /** Funded account id used as the source for read-only simulations. */
  readSource: string;
}
