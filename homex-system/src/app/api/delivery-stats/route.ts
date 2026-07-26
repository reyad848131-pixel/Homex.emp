import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/utils";
import { userCan } from "@/lib/permissions";

// Delivery / operations KPIs for the schedule dashboard. Requires the
// work-orders permission (admin/manager/driver).
export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const allowed = user.role === "admin" || user.role === "manager" || await userCan(user.role, "work_orders");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAhead = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [queueTotal, queueThisWeek, queueOverdue, installQueue, openServices, deliveredThisMonth, queueRows, deliveredRows] =
      await Promise.all([
        prisma.quotation.count({ where: { workStatus: "ready_for_delivery" } }),
        prisma.quotation.count({ where: { workStatus: "ready_for_delivery", deliveryDate: { gte: startOfToday, lte: weekAhead } } }),
        prisma.quotation.count({ where: { workStatus: "ready_for_delivery", deliveryDate: { lt: startOfToday } } }),
        prisma.quotation.count({ where: { workStatus: "ready_for_install" } }),
        prisma.serviceRequest.count({ where: { status: { not: "resolved" } } }),
        prisma.quotation.count({ where: { workStatus: { in: ["delivered", "ready_for_install", "installed"] }, deliveredAt: { gte: startOfMonth } } }),
        prisma.quotation.findMany({ where: { workStatus: "ready_for_delivery" }, select: { total: true, payments: { select: { amount: true } } } }),
        prisma.quotation.findMany({ where: { deliveredAt: { gte: startOfMonth }, deliveryDate: { not: null } }, select: { deliveredAt: true, deliveryDate: true } }),
      ]);

    // Cash still to collect across the delivery queue.
    const toCollect = queueRows.reduce((s, q) => {
      const paid = q.payments.reduce((p, x) => roundMoney(p + x.amount), 0);
      return roundMoney(s + Math.max(0, roundMoney(q.total - paid)));
    }, 0);

    // On-time %: delivered on or before the scheduled delivery date (date-only).
    let onTime = 0;
    for (const r of deliveredRows) {
      if (!r.deliveredAt || !r.deliveryDate) continue;
      const done = new Date(r.deliveredAt); done.setHours(0, 0, 0, 0);
      const sched = new Date(r.deliveryDate); sched.setHours(0, 0, 0, 0);
      if (done.getTime() <= sched.getTime()) onTime++;
    }
    const onTimePct = deliveredRows.length ? Math.round((onTime / deliveredRows.length) * 100) : null;

    return NextResponse.json({
      queueTotal, queueThisWeek, queueOverdue, installQueue, openServices,
      deliveredThisMonth, toCollect, onTimePct,
    });
  } catch (e) {
    console.error("API error [/api/delivery-stats]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
