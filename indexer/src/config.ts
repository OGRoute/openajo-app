import type { OpenAjoConfig } from "@openajo/sdk";

export interface IndexerConfig extends OpenAjoConfig {
  databaseUrl: string;
  startLedger: number;
  port: number;
  /** When set, the crank settles due circles using this secret's account. */
  crankSecret: string | null;
}

/** Fail fast at boot with a named list of everything missing. */
export function loadConfig(): IndexerConfig {
  const required = [
    "RPC_URL",
    "NETWORK_PASSPHRASE",
    "CIRCLE_CONTRACT_ID",
    "REPUTATION_CONTRACT_ID",
    "READ_SOURCE",
    "DATABASE_URL",
  ] as const;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`missing environment variables: ${missing.join(", ")}`);
  }
  return {
    rpcUrl: process.env.RPC_URL!,
    networkPassphrase: process.env.NETWORK_PASSPHRASE!,
    circleContractId: process.env.CIRCLE_CONTRACT_ID!,
    reputationContractId: process.env.REPUTATION_CONTRACT_ID!,
    readSource: process.env.READ_SOURCE!,
    databaseUrl: process.env.DATABASE_URL!,
    // Note: Soroban RPC retains ~7 days of events. START_LEDGER must be within
    // retention (use the ledger at contract deployment or later).
    startLedger: Number(process.env.START_LEDGER ?? 0),
    port: Number(process.env.PORT ?? 8080),
    crankSecret: process.env.CRANK_SECRET || null,
  };
}

export function log(level: "info" | "warn" | "error", msg: string, ctx?: object) {
  // Structured JSON logs; one line per entry.
  console.log(JSON.stringify({ level, msg, time: new Date().toISOString(), ...ctx }));
}
