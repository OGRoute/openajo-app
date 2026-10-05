# Writes

Every write follows the same path: build the transaction, `prepareTransaction`
to simulate it (which attaches authorization entries and resource fees), sign,
submit, then poll until included. Each function resolves to `{ hash }` once the
transaction is confirmed.

## Signing

Write functions take a signing function. The SDK never handles a key.

```ts
export type SignFn = (xdrBase64: string, networkPassphrase: string) => Promise<string>;
```

### Browser — Freighter

```ts
import { signTransaction } from "@stellar/freighter-api";
import type { SignFn } from "@openajo/sdk";

const sign: SignFn = async (xdr, networkPassphrase) => {
  const res = await signTransaction(xdr, { networkPassphrase });
  if (res.error) throw new Error(String(res.error));
  return res.signedTxXdr;
};
```

### Server — keypair, for fee-paying cranks only

```ts
import { keypairSigner } from "@openajo/sdk";

const sign = keypairSigner(process.env.CRANK_SECRET!);
```

{% hint style="danger" %}
`keypairSigner` exists for one purpose: paying fees to call the permissionless
`settle_cycle`. Never use it with a member's key, and never accept a secret key
from a user. See the [security model](../architecture/security-model.md).
{% endhint %}

## `createCircle(config, params, sign)`

```ts
import { createCircle, parseUnits } from "@openajo/sdk";

const { hash } = await createCircle(config, {
  creator: address,
  token: TOKEN_ID,                  // SAC contract id
  contribution: parseUnits("10"),   // 100000000n
  deposit: parseUnits("15"),        // 150000000n
  size: 5,
  periodSecs: 604800n,              // weekly
}, sign);
```

The creator becomes the first member and posts their deposit in the same
transaction, so they need `deposit` available and a trustline to the asset.

Choosing a deposit is a real decision, not a formality. It is the collateral that
covers a missed contribution, so a deposit below `contribution` cannot cover even
one miss and leaves the circle exposed. Above `contribution` buys margin at the
cost of locking more capital.

## `joinCircle(config, circleId, address, sign)`

Transfers the deposit into escrow and appends the member to the rotation. Fails
if the circle is not `Open`, is full, or the caller is already a member. The
circle starts automatically when the final member joins.

## `leaveCircle(config, circleId, address, sign)`

Only while the circle is `Open`. Refunds the deposit in full. The creator cannot
leave — they cancel instead (`CircleError.IsCreator`).

## `cancelCircle(config, circleId, creator, sign)`

Creator only, only while `Open`. Refunds every member's deposit.

## `contribute(config, circleId, address, sign)`

Pays this cycle's contribution. Requires an `Active` circle, a member who has not
already paid this cycle, and one who is not defaulted.

## `settleCycle(config, circleId, source, sign)`

```ts
await settleCycle(config, circleId, anyFundedAccount, sign);
```

**Permissionless** — `source` is whoever pays the fee, not an authorized party.
Any funded account can settle any due circle.

Settlement collects contributions, slashes deposits for anyone who did not pay,
marks members whose deposit could not cover the shortfall as defaulted, pays the
pot to the next eligible recipient, and advances the cycle. Fails with
`CircleError.NotDue` if the cycle is not yet due.

## Error handling

Writes throw the same `ContractCallError` as reads, because the failure surfaces
during simulation — before anything is signed or submitted. In practice this
means an invalid action costs the user nothing: the SDK decodes the
`Error(Contract, #N)` raised inside `prepareTransaction` into the same typed
error a read would throw, so one error path handles both.

```ts
import { ContractCallError, CircleError } from "@openajo/sdk";

try {
  await contribute(config, id, address, sign);
} catch (e) {
  if (e instanceof ContractCallError && e.code === CircleError.AlreadyPaid) {
    // already contributed this cycle
  }
}
```

A signature rejected in Freighter surfaces as an ordinary `Error` from your
`SignFn`, not a `ContractCallError`. Distinguish the two: a user cancelling is
not a failure worth showing as one.
