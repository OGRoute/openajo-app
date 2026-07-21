// Some hosts (incl. the dev laptop this was built on) resolve IPv6 first and
// stall on Soroban RPC; force IPv4-first before any HTTP client loads.
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { PrismaClient } from "@prisma/client";
import { loadConfig, log } from "./config.js";
import { runPoller } from "./poller.js";
import { runCrank } from "./crank.js";
import { startApi } from "./api.js";

async function main() {
  const config = loadConfig();
  const prisma = new PrismaClient({
    datasources: { db: { url: config.databaseUrl } },
  });

  await startApi(config, prisma);
  log("info", "api listening", { port: config.port });

  // Poller and crank run forever; api serves concurrently.
  void runCrank(config, prisma);
  await runPoller(config, prisma);
}

main().catch((e) => {
  log("error", "fatal", { error: (e as Error).message });
  process.exit(1);
});
