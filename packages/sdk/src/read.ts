import {
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import {
  decodeCircle,
  decodeMemberState,
  decodeReputation,
  fromScVal,
  scAddr,
  scU32,
} from "./scval.js";
import {
  CIRCLE_ERROR_MESSAGES,
  type Circle,
  type MemberState,
  type OpenAjoConfig,
  type Reputation,
} from "./types.js";

/** Thrown when a simulation fails with a decoded contract error code. */
export class ContractCallError extends Error {
  constructor(
    public readonly code: number | null,
    message: string,
  ) {
    super(message);
    this.name = "ContractCallError";
  }
}

function decodeSimError(raw: string): ContractCallError {
  // Simulation errors carry `Error(Contract, #N)` for contracterror panics.
  const m = raw.match(/Error\(Contract, #(\d+)\)/);
  if (m) {
    const code = Number(m[1]);
    return new ContractCallError(
      code,
      CIRCLE_ERROR_MESSAGES[code] ?? `contract error #${code}`,
    );
  }
  return new ContractCallError(null, raw);
}

async function simulate(
  config: OpenAjoConfig,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<xdr.ScVal> {
  const server = new rpc.Server(config.rpcUrl);
  const source = await server.getAccount(config.readSource);
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw decodeSimError(sim.error);
  if (!sim.result) throw new ContractCallError(null, "simulation returned no result");
  return sim.result.retval;
}

export async function getCircle(config: OpenAjoConfig, id: number): Promise<Circle> {
  return decodeCircle(
    await simulate(config, config.circleContractId, "get_circle", [scU32(id)]),
  );
}

export async function getMembers(config: OpenAjoConfig, id: number): Promise<string[]> {
  const raw = fromScVal<unknown[]>(
    await simulate(config, config.circleContractId, "get_members", [scU32(id)]),
  );
  return raw.map(String);
}

export async function getMember(
  config: OpenAjoConfig,
  id: number,
  member: string,
): Promise<MemberState> {
  return decodeMemberState(
    await simulate(config, config.circleContractId, "get_member", [
      scU32(id),
      scAddr(member),
    ]),
  );
}

export async function getCycleDeadline(
  config: OpenAjoConfig,
  id: number,
): Promise<bigint> {
  return fromScVal<bigint>(
    await simulate(config, config.circleContractId, "cycle_deadline", [scU32(id)]),
  );
}

export async function getTotalCircles(config: OpenAjoConfig): Promise<number> {
  return Number(
    fromScVal<number>(
      await simulate(config, config.circleContractId, "total_circles", []),
    ),
  );
}

export async function getReputation(
  config: OpenAjoConfig,
  member: string,
): Promise<Reputation> {
  return decodeReputation(
    await simulate(config, config.reputationContractId, "get_reputation", [
      scAddr(member),
    ]),
  );
}
