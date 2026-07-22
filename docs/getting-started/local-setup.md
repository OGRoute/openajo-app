# Local setup

You need **Node 20+**. You do not need Rust, the Stellar CLI, or any Soroban
knowledge to work on this repo — the contracts are already deployed to testnet
and the checked-in configuration points at them.

Postgres is only required if you are working on the indexer.

## The web app and SDK

```bash
git clone https://github.com/OGRoute/openajo-app
cd openajo-app
npm install
cp .env.example apps/web/.env.local
npm run dev --workspace apps/web
```

That gives you a working app at `http://localhost:3000` against the deployed
testnet contracts — you can create, join, contribute to, and settle real circles
immediately. The testnet contract IDs ship in `.env.example`, so there is nothing
to fill in.

The app **degrades gracefully without the indexer**. Live chain reads still work,
so individual circle pages are fully functional; the lists and aggregate stats
that depend on the indexer show as unavailable. For most web work you never need
to run the indexer at all.

You will also need [Freighter](https://freighter.app) installed, set to
**Testnet**, with a funded account. Fund one from
[Friendbot](https://friendbot.stellar.org).

## The indexer

Requires Postgres.

```bash
cd indexer
cp ../.env.example .env      # then edit DATABASE_URL and START_LEDGER
npx prisma migrate deploy
npm run dev                  # http://localhost:8080/health
```

Two values in the copied `.env` need real settings:

`DATABASE_URL` — your Postgres connection string.

`START_LEDGER` — the ledger to begin polling from. The example ships `0` as a
placeholder, which is not a usable value. Set it to a **recent** ledger, because
Soroban RPC retains only about seven days of events; asking for a window older
than retention makes the first poll fail. Getting the current ledger:

```bash
curl -s -X POST https://soroban-testnet.stellar.org \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}'
```

Leave `CRANK_SECRET` unset unless you specifically want this instance
auto-settling due circles. See [Configuration](configuration.md) for every
variable.

To point the web app at your local indexer, set
`NEXT_PUBLIC_INDEXER_URL=http://localhost:8080` in `apps/web/.env.local`.

## Checks

Run from the repo root; each fans out across the workspaces.

```bash
npm run typecheck    # all workspaces, TypeScript strict
npm test             # currently the SDK only — see below
npm run build        # includes the web production build
```

{% hint style="info" %}
`npm test` today runs only `packages/sdk`. The indexer and web workspaces have no
test infrastructure yet — that is
[issue #1](https://github.com/OGRoute/openajo-app/issues/1), and it is the
highest-priority open contribution in this repo.
{% endhint %}

## A build trap worth knowing

The SDK ships as TypeScript source rather than compiled output, and its internal
imports use ESM `.js` specifiers that resolve to `.ts` files. Next.js needs two
pieces of configuration to handle this, both already in
`apps/web/next.config.js`:

```js
transpilePackages: ["@openajo/sdk"],
webpack: (config) => {
  config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
  return config;
},
```

Without the `extensionAlias`, the web build fails with `Can't resolve
'./types.js'`. If you add a new consumer of the SDK, it needs the same treatment.
