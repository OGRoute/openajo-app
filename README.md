# OpenAjo — app

[![CI](https://github.com/OGRoute/openajo-app/actions/workflows/ci.yml/badge.svg)](https://github.com/OGRoute/openajo-app/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Good first issues](https://img.shields.io/github/issues/OGRoute/openajo-app/good%20first%20issue?label=good%20first%20issues)](https://github.com/OGRoute/openajo-app/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)

Application layer for **OpenAjo**: rotating savings (ajo / esusu / adashe) on
Stellar, enforced by Soroban smart contracts instead of a collector you have to
trust. Contracts live in the companion repo
**[openajo-contract](https://github.com/OGRoute/openajo-contract)**.

📖 **Developer docs — [`docs/`](docs/)**: architecture, SDK reference, indexer
REST API, local setup, and the security model.
**Protocol docs — [ogroute.gitbook.io](https://ogroute.gitbook.io/ogroute-docs)**:
how circles rotate, deposits and slashing, reputation, and user guides.

## What's here

| Workspace | Purpose |
|---|---|
| `packages/sdk` | Typed TS client for the contracts — reads via RPC simulation, writes via user-signed transactions, event decoding. |
| `indexer/` | Node service: polls Soroban RPC events into Postgres, serves a REST API, optionally cranks `settle_cycle` for due circles. |
| `apps/web` | Next.js app: create/join/run circles with Freighter, browse circles and on-chain reputation. |

Topology:

```
user ─▶ web ─▶ indexer REST (lists, history, stats)
         └───▶ Soroban RPC directly (writes signed by Freighter; live reads)
indexer ─▶ RPC getEvents ─▶ Postgres     indexer(crank) ─▶ settle_cycle
```

No server ever holds user keys. The only server key is the optional crank
account, which pays fees only — `settle_cycle` is permissionless on-chain.

## Deployed contracts (Stellar testnet)

```
CIRCLE     CA6NVGUC5LOZPOR3B266YXCA2TKXF4SH3362S4HRS5RQU53IDIM5F7FU
REPUTATION CD465NGKMGF2E6RGGL5DDMG3RZZFDINUR755FH3XRUZLMSQHTEBJWFD6
```

## Quick start

```bash
npm install
cp .env.example apps/web/.env.local          # contract ids are pre-filled for testnet

# web (works without the indexer; lists/stats need it)
npm run dev --workspace apps/web             # http://localhost:3000

# indexer (needs Postgres)
cd indexer
npx prisma migrate deploy && npm run dev     # http://localhost:8080/health

# sdk tests
npm test --workspace packages/sdk
```

Use Chrome/Edge/Firefox with the [Freighter](https://freighter.app) extension,
switched to **Testnet**, funded via [Friendbot](https://friendbot.stellar.org).

## Hosting

- `apps/web` → Vercel (set the `NEXT_PUBLIC_*` vars from `.env.example`).
- `indexer/` → Render (or any Node host) + managed Postgres in the same
  region; set `DATABASE_URL`, RPC vars and `START_LEDGER` (a recent ledger —
  RPC retains ~7 days of events).

## Contributing

Every open issue lists acceptance criteria, the files to touch, and the command
to verify the change — and none of them need Rust. Start with a
[`good first issue`](https://github.com/OGRoute/openajo-app/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22),
comment to claim it, then follow [CONTRIBUTING.md](CONTRIBUTING.md).

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md) — report vulnerabilities privately, never in an issue

## License

MIT — see [LICENSE](LICENSE).
