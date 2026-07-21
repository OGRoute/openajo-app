import type { PrismaClient } from "@prisma/client";
import type { rpc } from "@stellar/stellar-sdk";
import {
  getCircle,
  getMember,
  getMembers,
  getReputation,
  type OpenAjoEvent,
  type OpenAjoConfig,
} from "@openajo/sdk";
import { log } from "./config.js";

/** Insert the raw event row; idempotent via the RPC event id. */
export async function storeEvent(
  prisma: PrismaClient,
  ev: rpc.Api.EventResponse,
  decoded: OpenAjoEvent,
) {
  const base = {
    kind: decoded.kind,
    circleId: "circleId" in decoded ? decoded.circleId : null,
    member:
      "member" in decoded
        ? decoded.member
        : "recipient" in decoded
          ? decoded.recipient
          : "creator" in decoded
            ? decoded.creator
            : null,
    amount: "amount" in decoded ? decoded.amount : null,
    cycle: "cycle" in decoded ? decoded.cycle : null,
    txHash: ev.txHash ?? "",
    ledger: ev.ledger,
    timestamp: ev.ledgerClosedAt ? new Date(ev.ledgerClosedAt) : new Date(),
  };
  await prisma.event.upsert({
    where: { eventId: ev.id },
    create: { eventId: ev.id, ...base },
    update: {},
  });
}

/** Re-read a circle + all member states from chain and upsert. */
export async function refreshCircle(
  config: OpenAjoConfig,
  prisma: PrismaClient,
  circleId: number,
) {
  try {
    const circle = await getCircle(config, circleId);
    const members = await getMembers(config, circleId);

    await prisma.circle.upsert({
      where: { id: circleId },
      create: {
        id: circleId,
        creator: circle.creator,
        token: circle.token,
        contribution: circle.contribution,
        deposit: circle.deposit,
        size: circle.size,
        periodSecs: circle.periodSecs,
        status: circle.status,
        startedAt: circle.startedAt,
        currentCycle: circle.currentCycle,
      },
      update: {
        status: circle.status,
        startedAt: circle.startedAt,
        currentCycle: circle.currentCycle,
      },
    });

    for (let i = 0; i < members.length; i++) {
      const address = members[i];
      const state = await getMember(config, circleId, address);
      await prisma.member.upsert({
        where: { circleId_address: { circleId, address } },
        create: {
          circleId,
          address,
          joinOrder: i,
          depositRemaining: state.depositRemaining,
          received: state.received,
          defaulted: state.defaulted,
        },
        update: {
          joinOrder: i,
          depositRemaining: state.depositRemaining,
          received: state.received,
          defaulted: state.defaulted,
        },
      });
    }
  } catch (e) {
    log("error", "refreshCircle failed", {
      circleId,
      error: (e as Error).message,
    });
  }
}

export async function refreshReputation(
  config: OpenAjoConfig,
  prisma: PrismaClient,
  address: string,
) {
  try {
    const rep = await getReputation(config, address);
    await prisma.reputation.upsert({
      where: { address },
      create: { address, completed: rep.completed, defaulted: rep.defaulted },
      update: { completed: rep.completed, defaulted: rep.defaulted },
    });
  } catch (e) {
    log("error", "refreshReputation failed", {
      address,
      error: (e as Error).message,
    });
  }
}
