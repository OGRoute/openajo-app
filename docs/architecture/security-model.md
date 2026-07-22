# Security model

OpenAjo escrows money. This page states what the application layer can and cannot
do with it, because that boundary is the thing most worth being precise about.

## What the app layer cannot do

**It cannot move user funds.** Every state-changing contract call requires
`require_auth()` from the acting member. Authorization is checked by the contract
against a signature the user produced in Freighter. No component in this
repository holds a user key, so no component can produce that signature.

**It cannot lie about state in a way that costs you money.** Anything a user acts
on is read from the contract directly, not from the indexer. A compromised or
simply stale indexer can show a wrong list or a wrong timeline; it cannot cause a
user to sign a transaction against false state, because the transaction is built
and simulated from live chain reads.

**It cannot stall a payout.** `settle_cycle` is permissionless. If every server
in this repository disappeared, members could still settle their circles.

## Keys

There is exactly one secret key in the entire system, and it is optional:
`CRANK_SECRET`.

It pays transaction fees to call `settle_cycle` — a function anyone may call,
which takes no caller address and grants no privileges. Compromising it lets an
attacker settle circles that were already due, which is the thing the account
exists to do, and pay fees to do it. It cannot redirect a payout, modify a
circle, or touch a deposit.

Everything else the servers hold is public: contract IDs, an RPC URL, a network
passphrase, and `READ_SOURCE`, a funded account id used as the source for
read-only simulations. Nothing is signed with `READ_SOURCE` and nothing is
submitted; it exists because building a simulation envelope requires *a* source
account. Publishing it is harmless.

## The signing boundary

The SDK's write functions take a signing function, never a secret:

```ts
export type SignFn = (xdrBase64: string, networkPassphrase: string) => Promise<string>;
```

The browser supplies a Freighter-backed signer. The crank supplies
`keypairSigner`. The transaction-building code is identical in both cases and the
SDK itself never sees a key.

This is a deliberate structural choice rather than a stylistic one. A function
that accepted a secret key would work identically in the browser and on the
server, and someone would eventually pass one on the server — the type system
would not object. Accepting only a `SignFn` means "hold the user's key
server-side" is not a shape the API offers.

## Trust assumptions that remain

Being explicit about what you still have to trust:

**Soroban RPC.** Reads are simulations executed by an RPC node. A malicious node
could return false read results. It could not forge a signature or make an
invalid transaction succeed — those are validated by the network — but it could
mislead the UI. Point at an RPC endpoint you trust, or run your own.

**Freighter.** Users trust their wallet extension to show them what they are
signing and to keep their key. This is the standard browser-wallet assumption.

**The contracts.** They hold the funds, and they are **unaudited**. This is the
largest open risk in the project and the reason OpenAjo is testnet-only.

## Reporting a vulnerability

Do not open a public issue. Use GitHub's private vulnerability reporting on the
affected repository.

Highest priority: anything that bypasses authorization, manipulates settlement,
or strands or leaks escrowed value. If a finding concerns the contracts rather
than this repository, report it against
[openajo-contract](https://github.com/OGRoute/openajo-contract).
