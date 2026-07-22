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
  circleContractId: "CCLVOHGHDH32GWFAMCEMVHLNJSF6ENVHERYWU2OHUYWWLAOKLVR3HGKS",
  reputationContractId: "CDXPH2PYUTRW7GV57X6CJH3E3JOPROSC23NXPMAXOO3EOBI5UTCB2GTQ",
  readSource: "G...", // any funded account id; no secret
};
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
ContractCallError, CircleError, CIRCLE_ERROR_MESSAGES

// low-level ScVal helpers
scAddr, scI128, scU32, scU64, fromScVal, decodeCircle, decodeMemberState, decodeReputation
```

The `sc*` helpers are exported for building calls the SDK does not yet wrap. Most
consumers never need them.

Continue with [Reads](reads.md), [Writes](writes.md), and
[Amounts, events & errors](amounts-events-errors.md).
