# Contributing to openajo-app

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first. Comment on an
issue to claim it before you start, so two people do not do the same work.

## Setup

Node 22 (CI runs 22; Next 16 needs at least 20.9).

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

CI enforces all three, plus `npm audit` on production dependencies (high and
critical advisories fail the build) and a gitleaks scan of full history.

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
