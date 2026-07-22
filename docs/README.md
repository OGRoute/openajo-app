---
description: >-
  The TypeScript layer that reads and writes the OpenAjo Soroban contracts — SDK,
  indexer, and web app.
---

# Introduction

This is the developer documentation for **openajo-app**, the application layer of
[OpenAjo](https://ogroute.gitbook.io/ogroute-docs) — rotating savings circles
(_ajo_, _esusu_, _adashe_) on Stellar, enforced by a Soroban smart contract
instead of a collector you have to trust.

If you want to understand the *protocol* — how a circle rotates, how deposits
price default, how reputation carries between circles — read the
[protocol documentation](https://ogroute.gitbook.io/ogroute-docs) first. This
book is about the code that talks to it.

## What's in the repo

`openajo-app` is an npm workspaces monorepo with three workspaces:

| Workspace | What it is |
| --- | --- |
| `packages/sdk` | Typed TypeScript client for both contracts. The only code in the project that knows how to encode arguments and decode results, errors, and events. |
| `indexer/` | Node service. Polls Soroban RPC for contract events into Postgres, serves a read-only REST API, and optionally cranks `settle_cycle` for due circles. |
| `apps/web` | Next.js 14 app router interface. Users connect Freighter and sign their own transactions. |

The contracts themselves live in a separate repository,
[openajo-contract](https://github.com/OGRoute/openajo-contract). The dependency
runs one way: this repo depends on the contracts' deployed IDs, function
signatures, and event shapes. The contracts depend on nothing here.

## Two ideas worth knowing up front

Almost everything in this codebase follows from two decisions.

**No server ever holds a user key.** The browser builds each transaction,
Freighter signs it, and it goes straight to Soroban RPC. There is no endpoint
that moves user funds, because there is no server-side key that could. The SDK's
write functions take a signing *function*, never a secret — see the
[security model](architecture/security-model.md).

**The indexer never trusts its own state.** Events tell it *which* circles
changed; it then re-reads those circles from the contract and overwrites what it
has. The database is a cache of chain truth, not a parallel ledger that could
drift from it — see [the indexer](architecture/indexer.md).

## Where to go next

* Running it locally → [Local setup](getting-started/local-setup.md)
* Building something against the contracts → [SDK overview](sdk/overview.md)
* Reading circle data over HTTP → [REST reference](api/reference.md)
* Contributing → [Contributing](contributing.md)

{% hint style="warning" %}
OpenAjo is **unaudited and testnet-only**. Do not point it at mainnet funds.
{% endhint %}
