import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const [employees, customers, categories, quotations, quoteItems, settings, auditLogs] = await Promise.all([
      prisma.employee.findMany(),
      prisma.customer.findMany(),
      prisma.category.findMany(),
      prisma.quotation.findMany(),
      prisma.quoteItem.findMany(),
      prisma.settings.findMany(),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 1000 }),
    ]);

    const backup = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      data: { employees, customers, categories, quotations, quoteItems, settings, auditLogs },
    };

    const json = JSON.stringify(backup, null, 2);
    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="homex-backup-${date}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
