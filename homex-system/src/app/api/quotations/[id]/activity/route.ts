import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Activity log for a single quotation: the audit-trail entries recorded against
// it (import, renumber, reassign, edits, status changes…). Managers see any
// order; a salesperson only their own.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const { id } = await params;

    const quotation = await prisma.quotation.findFirst({ where: { id }, select: { employeeId: true } });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isManager = user.role === "admin" || user.role === "ceo" || user.role === "manager";
    if (!isManager && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const logs = await prisma.auditLog.findMany({
      where: { entity: "quotation", entityId: id },
      select: { id: true, action: true, details: true, createdAt: true, employee: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      items: logs.map((l) => ({
        id: l.id,
        action: l.action,
        details: l.details,
        by: l.employee?.name || "—",
        at: l.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("API error [/api/quotations/[id]/activity]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
