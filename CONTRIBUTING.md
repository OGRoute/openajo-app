# Contributing to openajo-app

## Setup

```bash
npm install
cp .env.example apps/web/.env.local
npm run typecheck && npm test --workspace packages/sdk
```

The web app runs against the deployed testnet contracts with no further setup.
The indexer needs a `DATABASE_URL` (Postgres).

## Before opening a PR

```bash
npm run typecheck                    # all workspaces
npm test --workspace packages/sdk
npm run build --workspace apps/web
```

CI enforces all three plus secret scanning.

## Rules of the codebase

- TypeScript strict. No `any` except at documented library boundaries.
- **`bigint` for all token amounts end-to-end**; string-serialize at JSON
  edges; format only at the display edge. Never `Number()` a raw amount.
- No server-held user keys — users sign with Freighter. The crank secret signs
  only permissionless `settle_cycle` calls.
- Event topic/data shapes come from `openajo-contract`; changing decoding is a
  breaking change and needs a coordinated issue in both repos.
- UI must work in light and dark (CSS tokens in `globals.css`), and every
  interactive element must be keyboard-accessible.

## Commits

Conventional format: `type(scope): description` — scopes: `sdk`, `indexer`,
`web`, `ci`, `docs`. One logical unit per commit.
