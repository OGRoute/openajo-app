# Contributing

This repo is **Node only**. You do not need Rust, the Stellar CLI, or any Soroban
knowledge to contribute — the contracts are already deployed and the checked-in
config points at them. Postgres is needed only for indexer work.

That is deliberate. The pool of people who can fix an accessibility bug or write
a test suite is far larger than the pool of Rust smart-contract developers, and
we would rather not turn those contributors away.

## Picking work

[Open issues](https://github.com/OGRoute/openajo-app/issues). Comment to claim
one before starting.

* `good first issue` — self-contained, clear acceptance criteria
* `help wanted` — larger but well-specified
* `needs design` — **discuss the approach in the issue before writing code**

Every issue states why it matters, lists acceptance criteria as checkboxes,
points at the specific files, and names what you need installed.

## Before opening a pull request

```bash
npm run typecheck
npm test --workspace packages/sdk
npm run build --workspace apps/web
```

CI enforces these plus a secret scan. A pull request that fails CI will not be
reviewed until it is green.

`main` is protected: pull request required, one approving review, green CI,
linear history.

## Standards

**TypeScript**

* `strict` mode. No `any` except at a documented library boundary, with a comment
  saying why.
* `bigint` for amounts end to end. Format only at display, parse only at input.
  Never `Number()` a raw amount.
* No server-held user keys. Users sign with Freighter. Write paths take a
  `SignFn`, never a secret.

**UI**

* Must work in light and dark themes.
* Must be keyboard accessible. Inputs need explicit label association; async
  state changes need to be announced, not only shown.
* Offer only actions the contract would accept for the current state — a button
  that fails on submission costs the user a transaction to discover.

**Tests**

Currently only `packages/sdk` has tests. Standing up Vitest for the indexer and
web workspaces is
[issue #1](https://github.com/OGRoute/openajo-app/issues/1) and the highest
priority open contribution here — it unblocks a test requirement on everything
after it.

## Commits

Conventional format: `type(scope): description`.

Scopes: `sdk`, `indexer`, `web`, `ci`, `docs`. One logical unit per commit.

## Cross-repo changes

Contract event shapes and function signatures are a compatibility contract with
this repository. Renaming an event topic or changing a data tuple breaks every
consumer, and it breaks them silently — `decodeEvent` returns `null` rather than
throwing.

Any such change requires **coordinated issues in both repositories** with an
explicit "Depends on" reference, and the contract change must ship and deploy
first. This is the one real cost of keeping the contracts in a separate repo, and
it is worth paying attention to rather than discovering during a release.

## Security

Do not open a public issue for a vulnerability. Use GitHub's private
vulnerability reporting.

OpenAjo escrows funds. Authorization bypasses, settlement manipulation, and
anything that strands or leaks escrowed value are the highest-priority findings.
See the [security model](architecture/security-model.md).

OpenAjo is **unaudited and testnet-only**. Do not deploy it with mainnet funds.
