import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

// Remind the owning salesperson about quotes that have been sitting with the
// customer for a while without a decision, so they follow up before the lead
// goes cold. Runs daily via Vercel Cron; an admin can trigger it manually.
const STALE_DAYS = 3;
const OPEN_STATUSES = ["pending", "approved", "sent"];

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
    if (!isCron) {
      const session = await getAuth();
      const user = session?.user as any;
      if (!session || (user?.role !== "admin" && user?.role !== "manager")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);

    // Quotes still open, last touched more than STALE_DAYS ago, not yet nudged.
    const stale = await prisma.quotation.findMany({
      where: {
        status: { in: OPEN_STATUSES },
        followUpNotified: false,
        updatedAt: { lte: cutoff },
      },
      select: { id: true, quoteNumber: true, employeeId: true, customer: { select: { name: true } } },
      take: 200,
    });

    for (const q of stale) {
      await notify(
        q.employeeId,
        "متابعة عرض معلّق ⏰",
        `عرض السعر ${q.quoteNumber} للعميل ${q.customer.name} ما زال بانتظار رد — تابع العميل.`,
        "warning",
        `/quotations/${q.id}`
      ).catch(() => {});
      await prisma.quotation.update({ where: { id: q.id }, data: { followUpNotified: true } }).catch(() => {});
    }

    return NextResponse.json({ ok: true, notified: stale.length });
  } catch (err) {
    console.error("Cron follow-ups error:", err);
    return NextResponse.json({ error: "Follow-ups failed" }, { status: 500 });
  }
}
