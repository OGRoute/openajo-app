# The indexer

A Node service with three jobs: poll contract events into Postgres, serve a
read-only REST API over the result, and optionally settle due circles.

| File | Responsibility |
| --- | --- |
| `src/main.ts` | Entry point; starts poller, API, and crank |
| `src/poller.ts` | Polls `getEvents`, stores raw events, advances the cursor |
| `src/fold.ts` | Turns "these circles changed" into current state in Postgres |
| `src/api.ts` | Fastify routes |
| `src/crank.ts` | Optional `settle_cycle` caller |
| `src/config.ts` | Environment parsing |

## Chain-truth folding

This is the single most important design decision in the service, and it is
deliberately not the obvious one.

The obvious approach is to treat events as a change log: read a `contrib` event,
add to a balance; read a `payout` event, subtract. This is what most indexers
do, and it has a permanent failure mode — **the first time you miss one event,
your state is wrong forever**, and nothing detects it. Delta application
accumulates error and never self-corrects.

So the indexer does not do that. Events are used only as a **signal about which
circles changed**:

1. Poll `getEvents` for both contract IDs, starting from the stored cursor.
2. Store each raw event, keyed by the RPC event id, so reprocessing is idempotent.
3. Collect the set of circle ids those events touched.
4. For each touched circle, **re-read it from the contract** — `get_circle`,
   `get_members`, and `get_member` for each member — and upsert the result.

The database therefore cannot drift from the chain. If the indexer misses a
window, crashes mid-batch, falls behind, or is replayed from scratch, the next
refresh reconciles it to on-chain truth. Correctness does not depend on having
seen every event, only on noticing that *something* happened.

The cost is RPC traffic, and it is a real cost: `refreshCircle` currently issues
one simulation per member, so a 20-member circle takes 22 sequential round trips.
That is [issue #3](https://github.com/OGRoute/openajo-app/issues/3).

## Idempotency

Events are keyed by RPC event id, a string like `0001284511-0000000001` that is
unique and stable. Storing the same event twice is a no-op. This is what makes
the poller safe to restart at any point and safe to run with an overlapping
window — neither will duplicate history.

## The cursor

A single `Cursor` row holds the last processed ledger. On start the poller
resumes from it; if there is no row, it begins at `START_LEDGER`.

Because RPC retains only about seven days of events, this has a consequence worth
being explicit about: an indexer whose cursor falls further behind than retention
cannot catch up on the events it missed. Live state is still correct — it is
re-read from the contract, not reconstructed — but that stretch of *timeline* is
gone. Back-filling from an archive is
[issue #2](https://github.com/OGRoute/openajo-app/issues/2).

## Data model

Five Prisma models:

| Model | Holds |
| --- | --- |
| `Circle` | Folded circle state, keyed by contract circle id |
| `Member` | Per-member state, keyed by `(circleId, address)` |
| `Event` | Raw decoded events, keyed by RPC event id |
| `Reputation` | Completed and defaulted counts per address |
| `Cursor` | Last processed ledger |

`Circle`, `Member`, and `Reputation` are all derived — they can be dropped and
rebuilt from the chain. `Event` is the only table holding anything the chain will
not still have in a week.

## The crank

When `CRANK_SECRET` is set, the indexer periodically looks for circles whose
current cycle is due and calls `settle_cycle` on them.

`settle_cycle` takes no caller address and performs no authorization check on
who invoked it — anyone with a funded account can settle any due circle. The
crank is therefore a convenience that spares members from having to notice, not
a privileged operator. If it stops, settlement still works from the web app, by
script, or from anyone else's crank.

That property is what removes the trusted-operator problem from the protocol. It
is worth preserving: any change that makes settlement depend on this service
running would be a significant regression, whatever it did for latency.
