# SDK overview

`@openajo/sdk` is the typed TypeScript client for both OpenAjo contracts. It is
the only code in the project that knows their wire format.

It ships as **TypeScript source**, not compiled output — consumers transpile it.
See [Local setup](../getting-started/local-setup.md#a-build-trap-worth-knowing)
for the Next.js configuration this requires.

## Installing

The SDK is not published to npm. Inside this monorepo it resolves as a workspace:

```json
{ "dependencies": { "@openajo/sdk": "*" } }
```

Outside it, depend on the repository directly or vendor `packages/sdk`.

## Configuration

Every function takes an `OpenAjoConfig` as its first argument. There is no
module-level state and no client object to construct, which makes it trivial to
talk to two networks or two deployments in the same process.

```ts
import type { OpenAjoConfig } from "@openajo/sdk";

const config: OpenAjoConfig = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  circleContractId: "CA6NVGUC5LOZPOR3B266YXCA2TKXF4SH3362S4HRS5RQU53IDIM5F7FU",
  reputationContractId: "CD465NGKMGF2E6RGGL5DDMG3RZZFDINUR755FH3XRUZLMSQHTEBJWFD6",
  readSource: "G...", // any funded account id; no secret
};
```

The first call made with a config validates its shape and throws `ConfigError`
if an id is malformed, if the two contract ids are identical, if `readSource` is
not an account id, or if `rpcUrl` is not an http(s) URL. Presence checks alone
let a swapped or mistyped id through, and the failure then surfaces as an opaque
RPC error far from its cause. Pass a secret seed by mistake and the error says
so without echoing the key.

```ts
import { ConfigError, validateConfig } from "@openajo/sdk";

try {
  validateConfig(config); // optional: fail at boot rather than first call
} catch (e) {
  if (e instanceof ConfigError) process.exit(1);
}
```

## Types

Mirrors of the on-chain types:

```ts
type CircleStatus = "Open" | "Active" | "Completed" | "Cancelled";

interface Circle {
  creator: string;       // G...
  token: string;         // C... (SAC)
  contribution: bigint;  // raw token units
  deposit: bigint;
  size: number;          // u32
  periodSecs: bigint;    // u64
  status: CircleStatus;
  startedAt: bigint;     // 0n until Active
  currentCycle: number;  // u32, 0-based
}

interface MemberState {
  depositRemaining: bigint;
  received: boolean;
  defaulted: boolean;
}

interface Reputation {
  completed: number;
  defaulted: number;
}
```

Two details that cause bugs if missed: `currentCycle` is **0-based**, and
`startedAt` is `0n` until the circle becomes `Active`, not `null` or `undefined`.

## Surface

```ts
// reads — simulations, free, no signature
getCircle, getMembers, getMember, getCycleDeadline, getTotalCircles, getReputation

// writes — build, simulate, sign, submit, poll
createCircle, joinCircle, leaveCircle, cancelCircle, contribute, settleCycle

// signing
type SignFn, keypairSigner

// amounts
formatUnits, parseUnits

// events
decodeEvent, type OpenAjoEvent

// errors
ContractCallError, decodeContractError
CircleError, CIRCLE_ERROR_MESSAGES
ReputationError, REPUTATION_ERROR_MESSAGES

// validation
ConfigError, validateConfig, assertCreateCircleParams
assertAddress, assertCircleId, assertContractId, assertAccountId
isAccountId, isContractId, MIN_SIZE, MIN_PERIOD_SECS

// low-level ScVal helpers
scAddr, scI128, scU32, scU64, fromScVal, decodeCircle, decodeMemberState, decodeReputation
```

The `sc*` helpers are exported for building calls the SDK does not yet wrap. Most
consumers never need them.

Continue with [Reads](reads.md), [Writes](writes.md), and
[Amounts, events & errors](amounts-events-errors.md).
