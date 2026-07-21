import { Keypair } from "@stellar/stellar-sdk";
import { keypairSigner, settleCycle } from "@openajo/sdk";
import type { PrismaClient } from "@prisma/client";
import type { IndexerConfig } from "./config.js";
import { log } from "./config.js";

const CRANK_MS = 60_000;

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
        const deadline =
          c.startedAt + (BigInt(c.currentCycle) + 1n) * c.periodSecs;
        if (nowSecs <= deadline) continue;
        try {
          const res = await settleCycle(config, c.id, source, sign);
          log("info", "cranked settle_cycle", { circleId: c.id, tx: res.hash });
        } catch (e) {
          const msg = (e as Error).message;
          // NotDue = raced with a user settling manually; benign.
          if (!msg.includes("#10")) {
            log("warn", "crank settle failed", { circleId: c.id, error: msg });
          }
        }
      }
    } catch (e) {
      log("error", "crank iteration failed", { error: (e as Error).message });
    }
    await new Promise((r) => setTimeout(r, CRANK_MS));
  }
}
