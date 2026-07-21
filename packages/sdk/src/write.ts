import {
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { scAddr, scI128, scU32, scU64 } from "./scval.js";
import type { OpenAjoConfig } from "./types.js";

/**
 * Signs a prepared transaction XDR and returns the signed XDR.
 * Web: wrap Freighter's signTransaction. Crank: use keypairSigner below.
 */
export type SignFn = (xdrBase64: string, networkPassphrase: string) => Promise<string>;

/** Server-side signer for the crank (never ship a secret to a browser). */
export function keypairSigner(secret: string): SignFn {
  const kp = Keypair.fromSecret(secret);
  return async (xdrBase64, networkPassphrase) => {
    const tx = TransactionBuilder.fromXDR(xdrBase64, networkPassphrase);
    tx.sign(kp);
    return tx.toXDR();
  };
}

export interface WriteResult {
  hash: string;
}

async function invoke(
  config: OpenAjoConfig,
  sourceAccountId: string,
  method: string,
  args: xdr.ScVal[],
  sign: SignFn,
): Promise<WriteResult> {
  const server = new rpc.Server(config.rpcUrl);
  const source = await server.getAccount(sourceAccountId);
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(new Contract(config.circleContractId).call(method, ...args))
    .setTimeout(120)
    .build();

  // prepareTransaction simulates, attaches Soroban auth entries and resource fees.
  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await sign(prepared.toXDR(), config.networkPassphrase);
  const signed = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);

  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    throw new Error(`send failed: ${JSON.stringify(sent.errorResult)}`);
  }
  for (let i = 0; i < 30; i++) {
    const got = await server.getTransaction(sent.hash);
    if (got.status === "SUCCESS") return { hash: sent.hash };
    if (got.status === "FAILED") throw new Error(`transaction failed: ${sent.hash}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`transaction not confirmed in time: ${sent.hash}`);
}

export interface CreateCircleParams {
  creator: string;
  token: string;
  contribution: bigint;
  deposit: bigint;
  size: number;
  periodSecs: bigint;
}

export async function createCircle(
  config: OpenAjoConfig,
  p: CreateCircleParams,
  sign: SignFn,
): Promise<WriteResult> {
  return invoke(
    config,
    p.creator,
    "create_circle",
    [
      scAddr(p.creator),
      scAddr(p.token),
      scI128(p.contribution),
      scI128(p.deposit),
      scU32(p.size),
      scU64(p.periodSecs),
    ],
    sign,
  );
}

export async function joinCircle(
  config: OpenAjoConfig,
  circleId: number,
  member: string,
  sign: SignFn,
): Promise<WriteResult> {
  return invoke(config, member, "join", [scU32(circleId), scAddr(member)], sign);
}

export async function leaveCircle(
  config: OpenAjoConfig,
  circleId: number,
  member: string,
  sign: SignFn,
): Promise<WriteResult> {
  return invoke(config, member, "leave", [scU32(circleId), scAddr(member)], sign);
}

export async function cancelCircle(
  config: OpenAjoConfig,
  circleId: number,
  creator: string,
  sign: SignFn,
): Promise<WriteResult> {
  return invoke(config, creator, "cancel", [scU32(circleId), scAddr(creator)], sign);
}

export async function contribute(
  config: OpenAjoConfig,
  circleId: number,
  member: string,
  sign: SignFn,
): Promise<WriteResult> {
  return invoke(config, member, "contribute", [scU32(circleId), scAddr(member)], sign);
}

/** Permissionless: any funded account may settle a due cycle. */
export async function settleCycle(
  config: OpenAjoConfig,
  circleId: number,
  source: string,
  sign: SignFn,
): Promise<WriteResult> {
  return invoke(config, source, "settle_cycle", [scU32(circleId)], sign);
}
