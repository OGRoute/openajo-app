# OpenAjo — app

Application layer for **OpenAjo**: rotating savings (ajo / esusu / adashe) on
Stellar, enforced by Soroban smart contracts instead of a collector you have to
trust. Contracts live in the companion repo **openajo-contract**.

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
CIRCLE     CCLVOHGHDH32GWFAMCEMVHLNJSF6ENVHERYWU2OHUYWWLAOKLVR3HGKS
REPUTATION CDXPH2PYUTRW7GV57X6CJH3E3JOPROSC23NXPMAXOO3EOBI5UTCB2GTQ
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

## License

MIT — see [LICENSE](LICENSE).
