# REST reference

The indexer serves a read-only REST API over folded chain data. It is public and
unauthenticated — everything it exposes is already on-chain — and it accepts no
writes. Writes go directly to Soroban RPC from the user's wallet.

**Base URL:** your indexer deployment. Locally, `http://localhost:8080`.

CORS is open, so a browser client can call it directly.

{% hint style="info" %}
All integer amounts are serialized as **strings**, because they are `bigint` raw
token units and JSON numbers cannot hold them safely. Parse with `BigInt(...)`.
{% endhint %}

## `GET /health`

```json
{ "ok": true, "lastLedger": 1284591 }
```

`lastLedger` is the last ledger the poller processed. Use it as your liveness
check: if it stops advancing, the indexer is stuck, even though the process is
still answering.

## `GET /circles`

Query parameters: `status` (`Open` | `Active` | `Completed` | `Cancelled`),
`limit` (default 50, max 200), `offset`.

```json
{
  "total": 12,
  "items": [
    {
      "id": 3,
      "creator": "GCJDSDNBS5PYOEKUO2PUCE2HRJ6V5IUPC4YBN65XQ4LB5EWKUQBPKHYR",
      "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      "contribution": "100000000",
      "deposit": "150000000",
      "size": 3,
      "periodSecs": "604800",
      "status": "Active",
      "startedAt": "1784021895",
      "currentCycle": 1,
      "memberCount": 3
    }
  ]
}
```

`total` is the count matching the filter, not the page size — use it for
pagination.

## `GET /circles/:id`

The circle, its members in join order, and the full event timeline.

```json
{
  "id": 3,
  "creator": "GCJD…",
  "contribution": "100000000",
  "status": "Active",
  "currentCycle": 1,
  "members": [
    {
      "circleId": 3,
      "address": "GCJD…",
      "joinOrder": 0,
      "depositRemaining": "150000000",
      "received": true,
      "defaulted": false
    }
  ],
  "events": [
    {
      "eventId": "0001284511-0000000001",
      "kind": "payout",
      "member": "GCJD…",
      "amount": "300000000",
      "cycle": 0,
      "txHash": "9829798c24f7bb03411951fc475dd1bbb6993b7a49c2d58bdd8b7e743b1b7767",
      "ledger": 1284511,
      "timestamp": "2026-07-14T10:41:35.000Z"
    }
  ]
}
```

Returns `404` with `{ "error": "not found" }` for an unknown id.

`kind` is one of `create`, `join`, `start`, `contrib`, `slash`, `default`,
`payout`, `complete`, `cancel`.

## `GET /members/:address`

Reputation, memberships, and recent activity for one address.

```json
{
  "address": "GCJD…",
  "reputation": { "address": "GCJD…", "completed": 1, "defaulted": 0 },
  "memberships": [
    {
      "circleId": 3,
      "address": "GCJD…",
      "joinOrder": 0,
      "depositRemaining": "150000000",
      "received": true,
      "defaulted": false,
      "circle": { "id": 3, "status": "Active", "contribution": "100000000" }
    }
  ],
  "events": []
}
```

An address with no history returns zeroed reputation and empty arrays rather than
a `404`. Treat "unknown address" and "address with no activity" as the same case
— on-chain they are.

## `GET /stats`

```json
{
  "circles": 12,
  "active": 4,
  "completed": 7,
  "valueLocked": "1800000000",
  "paidOut": "9000000000"
}
```

`valueLocked` sums all outstanding member deposits. `paidOut` sums every `payout`
event the indexer has seen — so it is bounded by the indexer's history depth, not
by all time.

## Notes for integrators

**The API is a convenience, not the source of truth.** For anything a user is
about to act on — a circle's status, whether they have paid this cycle, the
deadline — read the contract directly with the [SDK](../sdk/overview.md). The
indexer can lag; the chain cannot.

**History depth is bounded by RPC retention** (about seven days of events) from
the indexer's first run. Live state is always complete regardless, because it is
re-read from the contract rather than reconstructed. Extending history is
[issue #2](https://github.com/OGRoute/openajo-app/issues/2).

**There is no rate limiting or authentication.** If you deploy an instance
publicly, put it behind whatever your platform offers.
