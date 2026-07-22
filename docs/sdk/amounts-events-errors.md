# Amounts, events & errors

## Amounts

All amounts are `bigint` in raw token units. Stellar Asset Contracts use **7
decimal places**, so `1` token is `10_000_000n`.

```ts
import { formatUnits, parseUnits } from "@openajo/sdk";

formatUnits(123456789n);    // "12.3456789"
formatUnits(100000000n);    // "10"
parseUnits("12.3456789");   // 123456789n
parseUnits("1.00000001");   // throws — finer than 7 dp
```

Both take an optional `decimals` argument defaulting to `7`.

The rule: **convert only at the edges.** Parse at input, format at display,
`bigint` everywhere between. Never call `Number()` on a raw amount — above
2⁵³ it silently loses precision, and there is no error to catch. `parseUnits`
throwing on excess precision is deliberate: silently truncating a user's input
is how people lose money by a rounding error.

## Events

```ts
import { decodeEvent, type OpenAjoEvent } from "@openajo/sdk";

for (const ev of page.events) {
  const decoded = decodeEvent(ev.topic, ev.value);
  if (!decoded) continue;    // not one of ours — e.g. a SAC transfer event
  if (decoded.kind === "payout") {
    decoded.recipient;  // string
    decoded.amount;     // bigint
    decoded.cycle;      // number
  }
}
```

`decodeEvent` returns `null` rather than throwing for events that are not
OpenAjo's, because contract invocations also emit SAC transfer events that share
the stream.

`OpenAjoEvent` is a discriminated union over `kind`:

| `kind` | Fields |
| --- | --- |
| `create` | `circleId`, `creator` |
| `join` | `circleId`, `member` |
| `start` | `circleId` |
| `contrib` | `circleId`, `member`, `cycle` |
| `slash` | `circleId`, `member`, `amount` |
| `default` | `circleId`, `member` |
| `payout` | `circleId`, `recipient`, `amount`, `cycle` |
| `complete` | `circleId` |
| `cancel` | `circleId` |
| `rep_complete` | `member` |
| `rep_default` | `member` |

{% hint style="warning" %}
Event topic and data layouts are a **compatibility contract** between
`openajo-contract` and this repository. Changing one breaks every consumer
silently. Such a change requires coordinated issues in both repos, and the
contract change ships and deploys first — see [Contributing](../contributing.md).
{% endhint %}

## Errors

`ContractCallError` carries the decoded contract error code.

```ts
import { ContractCallError, CircleError, CIRCLE_ERROR_MESSAGES } from "@openajo/sdk";
```

| Code | `CircleError` | Message |
| --- | --- | --- |
| 1 | `NotInitialized` | — |
| 2 | `AlreadyInitialized` | — |
| 3 | `NotFound` | That circle doesn't exist. |
| 4 | `BadStatus` | The circle isn't in the right state for that. |
| 5 | `AlreadyMember` | You're already a member of this circle. |
| 6 | `NotMember` | You're not a member of this circle. |
| 7 | `CircleFull` | This circle is already full. |
| 8 | `AlreadyPaid` | You've already contributed this cycle. |
| 9 | `Defaulted` | This membership has defaulted. |
| 10 | `NotDue` | The cycle isn't due to settle yet. |
| 11 | `IsCreator` | The creator can't leave — cancel instead. |
| 12 | `BadParams` | Invalid circle parameters. |
| 13 | `NotCreator` | Only the creator can do that. |

Codes 1 and 2 concern contract initialization and should never reach a user of a
deployed contract; they have no user-facing message.

Branch on `e.code`, never on `e.message`. The messages are user-facing copy —
they will be reworded, and they are a
[translation target](https://github.com/OGRoute/openajo-docs/issues/5). Codes are
stable.

```ts
if (e instanceof ContractCallError) {
  const msg = CIRCLE_ERROR_MESSAGES[e.code] ?? "Something went wrong.";
}
```

Always provide a fallback. A contract upgrade can introduce a code this table
does not know, and `undefined` rendered into the UI is worse than a generic
message.
