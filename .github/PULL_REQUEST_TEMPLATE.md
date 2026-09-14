## What this changes

<!-- One or two sentences. What does a reviewer need to know? -->

Closes #

## Workspace(s)

- [ ] `packages/sdk`
- [ ] `indexer`
- [ ] `apps/web`
- [ ] CI / docs

## How I verified it

```bash
npm run typecheck
npm test
npm run build --workspace apps/web
```

<!-- Paste anything else you ran: a screenshot for UI changes, a curl for API changes. -->

## Checklist

- [ ] CI is green
- [ ] Token amounts stay `bigint` end-to-end (no `Number()` on raw amounts)
- [ ] No server-side user keys introduced
- [ ] UI changes work in light and dark themes and by keyboard alone
- [ ] If event decoding changed, a coordinated issue exists in `openajo-contract`
