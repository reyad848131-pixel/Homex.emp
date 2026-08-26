import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/utils";
import { canViewFieldOps } from "@/lib/permissions";

// Delivery / operations KPIs for the schedule dashboard. Requires the
// work-orders permission (admin/manager/driver).
export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (!(await canViewFieldOps(user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAhead = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // The delivery schedule is keyed off dispatchDate now — the "queue" is every
    // order placed on a day but not yet delivered.
    const scheduledOpen = { dispatchDate: { not: null }, workStatus: { not: "delivered" } } as const;
    const [queueTotal, queueThisWeek, queueOverdue, openServices, deliveredThisMonth, queueRows, deliveredRows] =
      await Promise.all([
        prisma.quotation.count({ where: scheduledOpen }),
        prisma.quotation.count({ where: { dispatchDate: { gte: startOfToday, lte: weekAhead }, workStatus: { not: "delivered" } } }),
        prisma.quotation.count({ where: { dispatchDate: { lt: startOfToday }, workStatus: { not: "delivered" } } }),
        prisma.serviceRequest.count({ where: { status: { not: "resolved" } } }),
        prisma.quotation.count({ where: { workStatus: "delivered", deliveredAt: { gte: startOfMonth } } }),
        prisma.quotation.findMany({ where: scheduledOpen, select: { total: true, payments: { select: { amount: true } } } }),
        prisma.quotation.findMany({ where: { deliveredAt: { gte: startOfMonth }, dispatchDate: { not: null } }, select: { deliveredAt: true, dispatchDate: true } }),
      ]);

    // Cash still to collect across the delivery queue.
    const toCollect = queueRows.reduce((s, q) => {
      const paid = q.payments.reduce((p, x) => roundMoney(p + x.amount), 0);
      return roundMoney(s + Math.max(0, roundMoney(q.total - paid)));
    }, 0);

    // On-time %: delivered on or before the scheduled dispatch date (date-only).
    let onTime = 0;
    for (const r of deliveredRows) {
      if (!r.deliveredAt || !r.dispatchDate) continue;
      const done = new Date(r.deliveredAt); done.setHours(0, 0, 0, 0);
      const sched = new Date(r.dispatchDate); sched.setHours(0, 0, 0, 0);
      if (done.getTime() <= sched.getTime()) onTime++;
    }
    const onTimePct = deliveredRows.length ? Math.round((onTime / deliveredRows.length) * 100) : null;

    return NextResponse.json({
      queueTotal, queueThisWeek, queueOverdue, openServices,
      deliveredThisMonth, toCollect, onTimePct,
    });
  } catch (e) {
    console.error("API error [/api/delivery-stats]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
