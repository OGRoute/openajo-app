import { rpc } from "@stellar/stellar-sdk";
import { decodeEvent, type OpenAjoEvent } from "@openajo/sdk";
import type { PrismaClient } from "@prisma/client";
import type { IndexerConfig } from "./config.js";
import { log } from "./config.js";
import { refreshCircle, refreshReputation, storeEvent } from "./fold.js";

const POLL_MS = 5_000;
const PAGE_LIMIT = 100;

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
      const startLedger = Math.max(
        (cursorRow?.lastLedger ?? config.startLedger - 1) + 1,
        1,
      );

      const page = await server.getEvents({
        startLedger,
        filters: [
          {
            type: "contract",
            contractIds: [config.circleContractId, config.reputationContractId],
          },
        ],
        limit: PAGE_LIMIT,
      });

      const touchedCircles = new Set<number>();
      const touchedMembers = new Set<string>();
      let maxLedger = cursorRow?.lastLedger ?? config.startLedger - 1;

      for (const ev of page.events ?? []) {
        maxLedger = Math.max(maxLedger, ev.ledger);
        const decoded: OpenAjoEvent | null = decodeEvent(ev.topic, ev.value);
        if (!decoded) continue;

        await storeEvent(prisma, ev, decoded);

        if ("circleId" in decoded) touchedCircles.add(decoded.circleId);
        if (decoded.kind === "rep_complete" || decoded.kind === "rep_default") {
          touchedMembers.add(decoded.member);
        }
      }

      for (const id of touchedCircles) {
        await refreshCircle(config, prisma, id);
      }
      for (const member of touchedMembers) {
        await refreshReputation(config, prisma, member);
      }

      // Advance the cursor even on empty pages so restarts stay in retention.
      const advanceTo = Math.max(maxLedger, page.latestLedger - 1);
      await prisma.cursor.upsert({
        where: { id: 1 },
        create: { id: 1, lastLedger: advanceTo },
        update: { lastLedger: advanceTo },
      });

      if ((page.events ?? []).length > 0) {
        log("info", "folded events", {
          count: page.events.length,
          circles: [...touchedCircles],
        });
      }
    } catch (e) {
      log("error", "poller iteration failed", { error: (e as Error).message });
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
