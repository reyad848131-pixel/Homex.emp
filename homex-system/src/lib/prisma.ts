import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// At runtime prefer a pooled connection (e.g. Neon's -pooler host) for lower
// per-query latency in serverless. Falls back to DATABASE_URL when the pooled
// variable is not set, so nothing changes until DATABASE_URL_POOLED is added.
// Schema migrations (prisma db push) always run against DATABASE_URL directly.
const runtimeUrl = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasourceUrl: runtimeUrl,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
