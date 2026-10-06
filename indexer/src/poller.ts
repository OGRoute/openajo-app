import { rpc } from "@stellar/stellar-sdk";
import { decodeEvent, type OpenAjoEvent } from "@openajo/sdk";
import type { PrismaClient } from "@prisma/client";
import type { IndexerConfig } from "./config.js";
import { log } from "./config.js";
import { refreshCircle, refreshReputation, storeEvent } from "./fold.js";

const POLL_MS = 5_000;
const PAGE_LIMIT = 100;
/** Bound the work per tick; whatever is left is picked up on the next one. */
const MAX_PAGES_PER_TICK = 20;

export interface DrainResult {
  /** Highest ledger seen in a returned event, or null when none were. */
  maxLedger: number | null;
  /** RPC's latest ledger, for advancing the cursor over empty ranges. */
  latestLedger: number;
  /** False when the page budget ran out before RPC was caught up. */
  drained: boolean;
  events: number;
  circles: Set<number>;
  members: Set<string>;
}

/** The slice of rpc.Server the drain needs, so it can be driven by a fake. */
export interface EventSource {
  getEvents(request: rpc.Api.GetEventsRequest): Promise<rpc.Api.GetEventsResponse>;
}

/**
 * Read every event from `startLedger` onwards, following RPC's cursor.
 *
 * getEvents returns at most `limit` events per call. Reading a single page and
 * then advancing the stored ledger to RPC's latest silently discards the rest:
 * their circles never get marked as touched, so their rows stay stale until
 * some later event happens to touch them again. Follow the cursor instead.
 */
export async function drainEvents(
  server: EventSource,
  config: IndexerConfig,
  prisma: PrismaClient,
  startLedger: number,
): Promise<DrainResult> {
  const circles = new Set<number>();
  const members = new Set<string>();
  const filters = [
    {
      type: "contract" as const,
      contractIds: [config.circleContractId, config.reputationContractId],
    },
  ];

  let cursor: string | undefined;
  let maxLedger: number | null = null;
  let latestLedger = startLedger;
  let events = 0;
  let drained = false;

  for (let page = 0; page < MAX_PAGES_PER_TICK; page++) {
    // Cursor and ledger range are mutually exclusive in the RPC API.
    const res: rpc.Api.GetEventsResponse = cursor
      ? await server.getEvents({ filters, limit: PAGE_LIMIT, cursor })
      : await server.getEvents({ filters, limit: PAGE_LIMIT, startLedger });

    latestLedger = res.latestLedger;
    const batch = res.events ?? [];

    for (const ev of batch) {
      maxLedger = Math.max(maxLedger ?? 0, ev.ledger);
      const decoded: OpenAjoEvent | null = decodeEvent(ev.topic, ev.value);
      if (!decoded) continue;

      await storeEvent(prisma, ev, decoded);
      events++;

      if ("circleId" in decoded) circles.add(decoded.circleId);
      if (decoded.kind === "rep_complete" || decoded.kind === "rep_default") {
        members.add(decoded.member);
      }
    }

    // A short page means RPC had nothing more to give.
    if (batch.length < PAGE_LIMIT) {
      drained = true;
      break;
    }
    if (!res.cursor) {
      // Full page with no cursor: cannot page further without risking a loop.
      drained = true;
      break;
    }
    cursor = res.cursor;
  }

  return { maxLedger, latestLedger, drained, events, circles, members };
}

/**
 * Polls Soroban RPC getEvents for both contracts, stores raw event rows
 * (idempotent by event id), then refreshes touched circles/members from chain
 * state — events tell us WHAT changed, simulation reads give current truth,
 * so the fold can never drift from the contract.
 */
export async function runPoller(config: IndexerConfig, prisma: PrismaClient) {
  const server = new rpc.Server(config.rpcUrl);

  for (;;) {
    try {
      const cursorRow = await prisma.cursor.findUnique({ where: { id: 1 } });
      const lastLedger = cursorRow?.lastLedger ?? config.startLedger - 1;
      const startLedger = Math.max(lastLedger + 1, 1);

      const result = await drainEvents(server, config, prisma, startLedger);

      for (const id of result.circles) {
        await refreshCircle(config, prisma, id);
      }
      for (const member of result.members) {
        await refreshReputation(config, prisma, member);
      }

      // When fully caught up, advance over empty ranges so a restart stays
      // inside RPC's ~7-day event retention. When the page budget ran out,
      // stop one ledger short of the last event seen: a ledger's events can
      // straddle a page boundary, and re-reading it is free (storeEvent is
      // idempotent by event id) whereas skipping it loses data.
      const advanceTo = result.drained
        ? Math.max(result.maxLedger ?? lastLedger, result.latestLedger - 1)
        : Math.max((result.maxLedger ?? lastLedger) - 1, lastLedger);

      await prisma.cursor.upsert({
        where: { id: 1 },
        create: { id: 1, lastLedger: advanceTo },
        update: { lastLedger: advanceTo },
      });

      if (result.events > 0) {
        log("info", "folded events", {
          count: result.events,
          circles: [...result.circles],
          drained: result.drained,
        });
      }
      if (!result.drained) {
        log("warn", "event backlog exceeded the page budget this tick", {
          through: advanceTo,
          latestLedger: result.latestLedger,
        });
      }
    } catch (e) {
      log("error", "poller iteration failed", { error: (e as Error).message });
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
