import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditFieldOps } from "@/lib/permissions";

// Lists quotations whose delivery date is still an import estimate (flagged
// deliveryDateEstimated), so a manager can confirm the real dates in one place.
// Ordered by the estimated date so the list follows the timeline.
export async function GET(_req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (!(await canEditFieldOps(user.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rows = await prisma.quotation.findMany({
      where: { deliveryDateEstimated: true },
      select: {
        id: true, quoteNumber: true, originalNumber: true, deliveryDate: true, deliveryTime: true,
        workStatus: true, customer: { select: { name: true, governorate: true, wilayat: true } },
      },
      orderBy: [{ deliveryDate: "asc" }, { quoteNumber: "asc" }],
      take: 1000,
    });

    return NextResponse.json({
      count: rows.length,
      items: rows.map((q) => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        originalNumber: q.originalNumber,
        customerName: q.customer.name,
        place: [q.customer.governorate, q.customer.wilayat].filter(Boolean).join(" - "),
        deliveryDate: q.deliveryDate ? q.deliveryDate.toISOString() : null,
        deliveryTime: q.deliveryTime,
        workStatus: q.workStatus,
      })),
    });
  } catch (e) {
    console.error("API error [/api/estimated-dates]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
