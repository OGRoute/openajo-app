# Security Policy

Do **not** open public issues for vulnerabilities. Use GitHub's private
vulnerability reporting (Security → Advisories) on this repository.

Highest-concern areas:

- Transaction construction in `packages/sdk` (wrong args, wrong signer,
  fee/auth manipulation)
- The Freighter signing path in `apps/web` (a flaw that gets arbitrary
  transactions signed is critical)
- Indexer REST endpoints (injection, resource exhaustion — the API is public
  and unauthenticated by design, reads only)

Never commit secrets. `.env*` files are gitignored; `.env.example` carries
placeholders and public testnet values only.

Status: unaudited; testnet only.
