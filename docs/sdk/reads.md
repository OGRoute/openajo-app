# Reads

Reads are executed as RPC **simulations**. They cost nothing, require no
signature, submit nothing to the network, and return current chain state.

```ts
import {
  getCircle, getMembers, getMember,
  getCycleDeadline, getTotalCircles, getReputation,
} from "@openajo/sdk";
```

## `getCircle(config, id)`

```ts
const circle = await getCircle(config, 0);
// {
//   creator: "GCJD…", token: "CDLZ…",
//   contribution: 100000000n, deposit: 150000000n,
//   size: 3, periodSecs: 604800n,
//   status: "Active", startedAt: 1784021895n, currentCycle: 1,
// }
```

Throws `ContractCallError` with `code === CircleError.NotFound` for an unknown
id.

## `getMembers(config, id)`

Returns member addresses as `string[]` **in join order**.

```ts
const members = await getMembers(config, 0);
// ["GCJD…", "GABC…", "GXYZ…"]
```

Join order is not cosmetic — it is the payout rotation. Index 0 receives first.
Preserve it; do not sort for display without saying so.

## `getMember(config, id, address)`

```ts
const me = await getMember(config, 0, "GCJD…");
// { depositRemaining: 150000000n, received: true, defaulted: false }
```

The three fields you need to decide what a member may do:

* `depositRemaining` — collateral left. Falls as contributions are slashed.
* `received` — whether they have taken their payout. A member who has received
  is skipped in future rotation.
* `defaulted` — a missed contribution their deposit could not cover. Defaulted
  members are skipped in rotation and blocked from contributing.

## `getCycleDeadline(config, id)`

```ts
const due = await getCycleDeadline(config, 0);   // bigint, unix seconds
const isDue = due <= BigInt(Math.floor(Date.now() / 1000));
```

Compare against chain time, not browser time, when the result decides whether to
offer a settle button — a user with a skewed clock will otherwise be shown an
action the contract rejects.

## `getTotalCircles(config)`

```ts
const total = await getTotalCircles(config);   // number
```

Circle ids are `0 .. total - 1`, so this is what you iterate for a full scan.
Prefer the [indexer's `/circles`](../api/reference.md#get-circles) for listings —
scanning every circle over RPC on each page load is exactly what the indexer
exists to avoid.

## `getReputation(config, address)`

```ts
const rep = await getReputation(config, "GCJD…");
// { completed: 1, defaulted: 0 }
```

An address with no history returns zeros rather than throwing.

## Errors

Failed simulations throw `ContractCallError`, which decodes the contract's
`Error(Contract, #N)` into a numeric code and a human message.

```ts
import { ContractCallError, CircleError } from "@openajo/sdk";

try {
  await getCircle(config, 999);
} catch (e) {
  if (e instanceof ContractCallError) {
    e.code;                            // 3
    e.message;                         // "That circle doesn't exist."
    e.code === CircleError.NotFound;   // true
  }
  throw e;
}
```

Branch on `e.code`, never on `e.message` — the messages are user-facing copy and
will be reworded. See
[Amounts, events & errors](amounts-events-errors.md#errors) for the full code
table.

Error codes belong to the contract that raised them, and the two contracts use
the same low numbers for different conditions. `getReputation` therefore decodes
against `ReputationError`, every other read against `CircleError`. Check
`e.code` against the enum for the contract you called.
