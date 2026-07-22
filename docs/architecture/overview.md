# Overview

## Topology

```
user ──▶ apps/web ──▶ indexer REST API   (lists, history, stats)
              │
              └─────▶ Soroban RPC        (writes signed in Freighter; live reads)

indexer ──▶ Soroban RPC getEvents ──▶ Postgres
indexer ──▶ settle_cycle              (optional crank)
```

## Reads come from two places, deliberately

There are two ways to learn the state of a circle, and the codebase uses both on
purpose.

**Directly from the contract, by simulation.** Free, instant, requires no
signature, and is true by definition. Used for anything a user is about to act
on: a circle's status, their own `MemberState`, the cycle deadline. If the user
is about to sign a transaction based on a fact, that fact is read from the chain.

**From the indexer's REST API.** Used for lists, history, and aggregate stats —
"show me all open circles", "show this circle's timeline", "what is the total
value locked". Scanning every circle over RPC on every page load would be slow
and pointless, and none of it is safety-critical.

The rule is worth stating plainly because it is easy to get wrong: **the indexer
is a convenience, never the source of truth.** It can lag. The chain cannot.

## Writes never touch a server

Every state-changing call follows the same path:

1. The browser builds the transaction using the SDK.
2. `prepareTransaction` simulates it against RPC, which attaches the required
   authorization entries and resource fees.
3. Freighter signs it — in the user's extension, with the user's key.
4. The signed envelope goes straight to Soroban RPC.
5. The SDK polls until the transaction is included.

No OpenAjo server is involved at any step. There is no API endpoint that moves
funds, because there is no server-side key that could. See the
[security model](security-model.md).

## The SDK is the only encoder

`packages/sdk` is the single place in the project that knows how to turn a
JavaScript value into an `ScVal` for these contracts, how to turn a contract
error code into a message, and how to decode an event. Both the web app and the
indexer import it.

This matters more than it might appear. Contract argument encoding is easy to get
subtly wrong — an `i128` encoded as an `i64`, an address passed as a string — and
the failure mode is a confusing simulation error rather than a type error. Having
exactly one implementation means a fix lands everywhere at once, and means the
indexer and web app cannot disagree about what a contract call looks like.

## Money is `bigint`, everywhere

All amounts are raw token units as `bigint`, end to end: `i128` in the contract,
`bigint` in the SDK, Postgres `BigInt` in the indexer, and **strings** in JSON
responses, because JSON numbers cannot hold them safely.

There is no floating-point arithmetic anywhere in the stack. Values are formatted
to a decimal string only at the point of display and parsed back at the point of
input, via `formatUnits` and `parseUnits`. This is the standard defence against
rounding quietly changing someone's balance, and in a savings protocol it is not
optional.

## Web app routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page and stats |
| `/circles` | Browse circles, filterable by status |
| `/circles/new` | Create a circle |
| `/circles/[id]` | Circle detail — members, timeline, and the state-driven action panel |
| `/u/[address]` | A member's reputation and memberships |

The action panel on the circle page is driven by state rather than by a fixed
layout: it reads the circle's status and the connected wallet's `MemberState`,
then offers only the action that is actually valid — join, contribute, settle,
leave, or cancel. Offering a button the contract would reject is a bad
experience, and worse, it costs the user a failed transaction to discover.
