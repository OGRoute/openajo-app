import { Keypair } from "@stellar/stellar-sdk";
import { keypairSigner, settleCycle } from "@openajo/sdk";
import type { PrismaClient } from "@prisma/client";
import type { IndexerConfig } from "./config.js";
import { log } from "./config.js";

const CRANK_MS = 60_000;

export interface CycleState {
  startedAt: bigint;
  currentCycle: number;
  periodSecs: bigint;
  /** Members who have not defaulted — the ones the contract still expects to pay. */
  activeMembers: number;
  /** Distinct contributions recorded for `currentCycle`. */
  paidThisCycle: number;
}

/**
 * Why a cycle can be settled now, or null if it cannot.
 *
 * Mirrors `settle_cycle`: due when every non-defaulted member has paid, **or**
 * the deadline has passed. Waiting for the deadline alone — as this crank used
 * to — leaves a circle whose members all paid early sitting unpaid for the rest
 * of the period, even though anyone could have settled it immediately.
 */
export function settleReason(
  state: CycleState,
  nowSecs: bigint,
): "all-paid" | "deadline" | null {
  if (state.activeMembers > 0 && state.paidThisCycle >= state.activeMembers) {
    return "all-paid";
  }
  const deadline =
    state.startedAt + (BigInt(state.currentCycle) + 1n) * state.periodSecs;
  return nowSecs > deadline ? "deadline" : null;
}

/**
 * Optional settle crank. `settle_cycle` is permissionless on-chain; this
 * account pays only transaction fees and can move no funds. Runs only when
 * CRANK_SECRET is configured.
 */
export async function runCrank(config: IndexerConfig, prisma: PrismaClient) {
  if (!config.crankSecret) {
    log("info", "crank disabled (no CRANK_SECRET)");
    return;
  }
  const source = Keypair.fromSecret(config.crankSecret).publicKey();
  const sign = keypairSigner(config.crankSecret);

  for (;;) {
    try {
      const nowSecs = BigInt(Math.floor(Date.now() / 1000));
      const activeCircles = await prisma.circle.findMany({
        where: { status: "Active" },
      });

      for (const c of activeCircles) {
        const [activeMembers, paidThisCycle] = await Promise.all([
          prisma.member.count({ where: { circleId: c.id, defaulted: false } }),
          prisma.event.count({
            where: { circleId: c.id, kind: "contrib", cycle: c.currentCycle },
          }),
        ]);

        const reason = settleReason(
          {
            startedAt: c.startedAt,
            currentCycle: c.currentCycle,
            periodSecs: c.periodSecs,
            activeMembers,
            paidThisCycle,
          },
          nowSecs,
        );
        if (!reason) continue;

        try {
          const res = await settleCycle(config, c.id, source, sign);
          log("info", "cranked settle_cycle", {
            circleId: c.id,
            cycle: c.currentCycle,
            reason,
            tx: res.hash,
          });
        } catch (e) {
          const msg = (e as Error).message;
          // NotDue = our view of who paid is behind the chain, or a user
          // settled first. Either way the chain is the authority; benign.
          if (!msg.includes("#10")) {
            log("warn", "crank settle failed", {
              circleId: c.id,
              reason,
              error: msg,
            });
          }
        }
      }
    } catch (e) {
      log("error", "crank iteration failed", { error: (e as Error).message });
    }
    await new Promise((r) => setTimeout(r, CRANK_MS));
  }
}
