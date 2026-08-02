import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { curtainMinCount, curtainCountFromDesc } from "@/lib/order-rules";

// Lists active quotations that have a curtain item BELOW the customer's wilayat
// minimum — for cleaning up historical/imported orders that predate (or slipped
// past) the rule. Manager/admin only. On-demand (scans items), not on a hot path.
export async function GET(_req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const isManager = user.role === "admin" || user.role === "ceo" || user.role === "manager";
    if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rows = await prisma.quotation.findMany({
      where: { items: { some: { description: { startsWith: "ستائر" } } } },
      select: {
        id: true, quoteNumber: true, originalNumber: true,
        customer: { select: { name: true, wilayat: true } },
        items: { select: { description: true } },
      },
      take: 2000,
    });

    const violations: Array<{ id: string; quoteNumber: string; customerName: string; wilayat: string; count: number; min: number }> = [];
    for (const q of rows) {
      const min = curtainMinCount(q.customer.wilayat);
      // Flag the smallest offending curtain item on the order.
      let worst = 0;
      for (const it of q.items) {
        const n = curtainCountFromDesc(it.description);
        if (n > 0 && n < min && (worst === 0 || n < worst)) worst = n;
      }
      if (worst > 0) {
        violations.push({
          id: q.id, quoteNumber: q.quoteNumber, customerName: q.customer.name,
          wilayat: q.customer.wilayat || "-", count: worst, min,
        });
      }
    }
    violations.sort((a, b) => a.count - b.count);

    return NextResponse.json({ scanned: rows.length, count: violations.length, violations: violations.slice(0, 500) });
  } catch (e) {
    console.error("API error [/api/quotations/curtain-audit]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
