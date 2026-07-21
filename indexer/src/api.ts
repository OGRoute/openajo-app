import Fastify from "fastify";
import cors from "@fastify/cors";
import type { PrismaClient } from "@prisma/client";
import type { IndexerConfig } from "./config.js";

/** JSON.stringify that serializes bigint as string. */
function json(payload: unknown): string {
  return JSON.stringify(payload, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
}

export async function startApi(config: IndexerConfig, prisma: PrismaClient) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  app.get("/health", async (_req, reply) => {
    const cursor = await prisma.cursor.findUnique({ where: { id: 1 } });
    reply.type("application/json").send(
      json({ ok: true, lastLedger: cursor?.lastLedger ?? null }),
    );
  });

  app.get<{ Querystring: { status?: string; limit?: string; offset?: string } }>(
    "/circles",
    async (req, reply) => {
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const offset = Number(req.query.offset ?? 0);
      const where = req.query.status ? { status: req.query.status } : {};
      const [items, total] = await Promise.all([
        prisma.circle.findMany({
          where,
          orderBy: { id: "desc" },
          take: limit,
          skip: offset,
          include: { _count: { select: { members: true } } },
        }),
        prisma.circle.count({ where }),
      ]);
      reply.type("application/json").send(
        json({
          total,
          items: items.map((c) => ({
            ...c,
            memberCount: c._count.members,
            _count: undefined,
          })),
        }),
      );
    },
  );

  app.get<{ Params: { id: string } }>("/circles/:id", async (req, reply) => {
    const id = Number(req.params.id);
    const circle = await prisma.circle.findUnique({
      where: { id },
      include: { members: { orderBy: { joinOrder: "asc" } } },
    });
    if (!circle) {
      reply.code(404).type("application/json").send(json({ error: "not found" }));
      return;
    }
    const events = await prisma.event.findMany({
      where: { circleId: id },
      orderBy: [{ ledger: "asc" }, { eventId: "asc" }],
    });
    reply.type("application/json").send(json({ ...circle, events }));
  });

  app.get<{ Params: { address: string } }>(
    "/members/:address",
    async (req, reply) => {
      const address = req.params.address;
      const [memberships, reputation, events] = await Promise.all([
        prisma.member.findMany({ where: { address }, include: { circle: true } }),
        prisma.reputation.findUnique({ where: { address } }),
        prisma.event.findMany({
          where: { member: address },
          orderBy: { ledger: "desc" },
          take: 100,
        }),
      ]);
      reply.type("application/json").send(
        json({
          address,
          reputation: reputation ?? { address, completed: 0, defaulted: 0 },
          memberships,
          events,
        }),
      );
    },
  );

  app.get("/stats", async (_req, reply) => {
    const [circles, active, completed, locked, paidOut] = await Promise.all([
      prisma.circle.count(),
      prisma.circle.count({ where: { status: "Active" } }),
      prisma.circle.count({ where: { status: "Completed" } }),
      prisma.member.aggregate({ _sum: { depositRemaining: true } }),
      prisma.event.aggregate({
        where: { kind: "payout" },
        _sum: { amount: true },
      }),
    ]);
    reply.type("application/json").send(
      json({
        circles,
        active,
        completed,
        valueLocked: locked._sum.depositRemaining ?? 0n,
        paidOut: paidOut._sum.amount ?? 0n,
      }),
    );
  });

  await app.listen({ port: config.port, host: "0.0.0.0" });
  return app;
}
