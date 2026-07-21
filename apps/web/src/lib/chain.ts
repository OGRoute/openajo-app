import type { OpenAjoConfig } from "@openajo/sdk";

/** Client-side config from NEXT_PUBLIC_ env (inlined at build). */
export function chainConfig(): OpenAjoConfig {
  const cfg = {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
    circleContractId: process.env.NEXT_PUBLIC_CIRCLE_CONTRACT_ID,
    reputationContractId: process.env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID,
    readSource: process.env.NEXT_PUBLIC_READ_SOURCE,
  };
  for (const [k, v] of Object.entries(cfg)) {
    if (!v) throw new Error(`missing NEXT_PUBLIC config: ${k}`);
  }
  return cfg as OpenAjoConfig;
}

export const TOKEN_ID = process.env.NEXT_PUBLIC_TOKEN_ID ?? "";
export const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? "";
