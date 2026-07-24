import { prisma } from "./prisma";

// How many automatic snapshots to keep in the database.
const RETENTION = 14;

/**
 * Builds a full data snapshot of the system (excluding password hashes).
 * Shared by the manual download endpoint and the scheduled cron job.
 */
export async function buildBackup() {
  const [employees, customers, categories, quotations, quoteItems, payments, invoices, settings, auditLogs] =
    await Promise.all([
      prisma.employee.findMany({
        select: { id: true, name: true, civilId: true, role: true, phone: true, isActive: true, lastLogin: true, createdAt: true },
      }),
      prisma.customer.findMany(),
      prisma.category.findMany(),
      prisma.quotation.findMany(),
      prisma.quoteItem.findMany(),
      prisma.payment.findMany(),
      prisma.invoice.findMany(),
      prisma.settings.findMany(),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 1000 }),
    ]);

  return {
    version: "1.1",
    exportedAt: new Date().toISOString(),
    data: { employees, customers, categories, quotations, quoteItems, payments, invoices, settings, auditLogs },
  };
}

/**
 * Creates a stored snapshot in the backups table and prunes older ones beyond
 * the retention window. Returns the new backup row (without its heavy data).
 */
export async function createSnapshot(source: "auto" | "manual" = "auto") {
  const backup = await buildBackup();
  const json = JSON.stringify(backup);

  const row = await prisma.backup.create({
    data: { data: json, size: json.length, source },
    select: { id: true, size: true, source: true, createdAt: true },
  });

  // Prune anything older than the most recent RETENTION snapshots.
  const keep = await prisma.backup.findMany({
    orderBy: { createdAt: "desc" },
    take: RETENTION,
    select: { id: true },
  });
  await prisma.backup.deleteMany({
    where: { id: { notIn: keep.map((b) => b.id) } },
  });

  return row;
}
