# Configuration

All configuration is environment variables. `.env.example` at the repo root holds
every one of them, with working testnet values already filled in.

## Web app (`apps/web/.env.local`)

| Variable | Example | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Must match the network Freighter is set to |
| `NEXT_PUBLIC_CIRCLE_CONTRACT_ID` | `CCLVOHGH…` | Deployed `circle` contract |
| `NEXT_PUBLIC_REPUTATION_CONTRACT_ID` | `CDXPH2PY…` | Deployed `reputation` contract |
| `NEXT_PUBLIC_TOKEN_ID` | `CDLZFC3S…` | SAC address for the circle asset |
| `NEXT_PUBLIC_READ_SOURCE` | `GCJDSDNB…` | Any funded account id. Source for read simulations — **no secret** |
| `NEXT_PUBLIC_INDEXER_URL` | `http://localhost:8080` | Indexer base URL |

{% hint style="warning" %}
`NEXT_PUBLIC_*` values are **inlined at build time**, not read at runtime.
Changing one requires a rebuild and redeploy — restarting the process is not
enough. This catches people out on Vercel in particular.
{% endhint %}

### Deriving the token id

The circle asset is a Stellar Asset Contract. For native XLM on testnet:

```bash
stellar contract id asset --asset native --network testnet
```

XLM is convenient for development. A production deployment would use a stablecoin
SAC such as USDC, since a savings circle denominated in a volatile asset defeats
the point.

### About `READ_SOURCE`

Reads are executed as RPC *simulations*, and a simulation still needs a source
account to build a transaction envelope around. Nothing is signed and nothing is
submitted, so this account needs no secret key and spends nothing — it only has
to exist and be funded. Publishing it is harmless, which is why it is a
`NEXT_PUBLIC_` variable.

## Indexer (`indexer/.env`)

| Variable | Notes |
| --- | --- |
| `RPC_URL` | Same endpoint, server side |
| `NETWORK_PASSPHRASE` | Same value as the web app |
| `CIRCLE_CONTRACT_ID` | Same deployed contract |
| `REPUTATION_CONTRACT_ID` | Same deployed contract |
| `READ_SOURCE` | Funded account id for read simulations |
| `DATABASE_URL` | Postgres connection string |
| `START_LEDGER` | Ledger to begin polling from — must be within RPC retention |
| `CRANK_SECRET` | **Optional.** An `S…` secret key. When set, the indexer settles due circles |
| `PORT` | Defaults to `8080` |

### `START_LEDGER`

Soroban RPC keeps roughly seven days of events. If `START_LEDGER` is older than
that window, the first poll errors. If it is too recent, you simply see less
history — live circle state is re-read from the contract regardless, so it is
always correct either way.

The consequence is that an indexer started today cannot show a timeline older
than about a week. That limitation is
[issue #2](https://github.com/OGRoute/openajo-app/issues/2).

### `CRANK_SECRET`

Optional, and the only secret key anywhere in the system. When set, the indexer
calls `settle_cycle` for circles whose cycle is due.

This is a **convenience, not a dependency**. `settle_cycle` is permissionless —
any funded account can call it — so if the crank stops, any member can settle
their own circle from the web app. The crank account pays transaction fees and
can do nothing else: it cannot redirect a payout, change a circle, or touch a
deposit.

Leave it unset in development. Never commit it.

## Secrets

`.env` files are gitignored. `.env.example` contains only placeholders and public
testnet values — no secret key belongs in it, ever. CI runs a secret scan on
every pull request, and it will fail the build rather than let one through.
