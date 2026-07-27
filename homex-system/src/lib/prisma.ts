import { PrismaClient, Prisma } from "@prisma/client";

// Models that use soft delete (a Trash). Read queries automatically exclude
// rows with deletedAt set, so deleted quotations/customers vanish from every
// list, count, search, report, etc. without touching each query. To reach
// deleted rows (the Trash page), pass an explicit deletedAt filter — it's kept.
// Note: findUnique/findUniqueOrThrow only accept unique fields in `where`, so
// by-id lookups that must respect the Trash use findFirst instead (see repo).
const READ_FILTER_OPS = new Set([
  "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy",
]);

async function softDeleteFilter({ operation, args, query }: any) {
  if (READ_FILTER_OPS.has(operation)) {
    const a = { ...(args || {}) };
    a.where = { ...(a.where || {}) };
    if (a.where.deletedAt === undefined) a.where.deletedAt = null;
    return query(a);
  }
  return query(args);
}

// At runtime prefer a pooled connection (e.g. Neon's -pooler host) for lower
// per-query latency in serverless. Falls back to DATABASE_URL when the pooled
// variable is not set. Schema migrations (prisma db push) use DATABASE_URL.
const runtimeUrl = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasourceUrl: runtimeUrl,
  });
  return base.$extends({
    query: {
      quotation: { $allOperations: softDeleteFilter },
      customer: { $allOperations: softDeleteFilter },
    },
  });
}

type ExtendedPrisma = ReturnType<typeof createPrismaClient>;
const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrisma };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { Prisma };
