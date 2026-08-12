import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role === "sales") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "month";

  const now = new Date();
  let startDate: Date;
  switch (period) {
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const quotations = await prisma.quotation.findMany({
    where: { createdAt: { gte: startDate } },
    include: {
      employee: { select: { name: true } },
      customer: { select: { governorate: true } },
      items: { include: { category: { select: { nameAr: true } } } },
    },
  });

  const statusCounts: Record<string, number> = { draft: 0, pending: 0, approved: 0, declined: 0 };
  let totalRevenue = 0;
  let totalApproved = 0;
  const employeeStats: Record<string, { name: string; count: number; total: number; approved: number }> = {};
  const categoryCounts: Record<string, { name: string; count: number; total: number }> = {};
  const governorateCounts: Record<string, number> = {};
  const dailyData: Record<string, { count: number; total: number }> = {};
  // Operational KPIs.
  let deliveredCount = 0, deliveredWithDate = 0, onTimeCount = 0, sumDeliverDays = 0, deliverDaysCount = 0;

  for (const q of quotations) {
    statusCounts[q.status] = (statusCounts[q.status] || 0) + 1;

    if (q.deliveredAt) {
      deliveredCount++;
      const deliveredDay = q.deliveredAt.toISOString().split("T")[0];
      if (q.deliveryDate) {
        deliveredWithDate++;
        const scheduledDay = q.deliveryDate.toISOString().split("T")[0];
        if (deliveredDay <= scheduledDay) onTimeCount++; // delivered on/before its date
      }
      const days = (q.deliveredAt.getTime() - q.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      if (days >= 0) { sumDeliverDays += days; deliverDaysCount++; }
    }
    totalRevenue = roundMoney(totalRevenue + q.total);
    if (q.status === "approved") totalApproved = roundMoney(totalApproved + q.total);

    const empKey = q.employee.name;
    if (!employeeStats[empKey]) employeeStats[empKey] = { name: empKey, count: 0, total: 0, approved: 0 };
    employeeStats[empKey].count++;
    employeeStats[empKey].total = roundMoney(employeeStats[empKey].total + q.total);
    if (q.status === "approved") employeeStats[empKey].approved++;

    const gov = q.customer.governorate;
    governorateCounts[gov] = (governorateCounts[gov] || 0) + 1;

    const day = q.createdAt.toISOString().split("T")[0];
    if (!dailyData[day]) dailyData[day] = { count: 0, total: 0 };
    dailyData[day].count++;
    dailyData[day].total = roundMoney(dailyData[day].total + q.total);

    for (const item of q.items) {
      const catName = item.category.nameAr;
      if (!categoryCounts[catName]) categoryCounts[catName] = { name: catName, count: 0, total: 0 };
      categoryCounts[catName].count++;
      categoryCounts[catName].total = roundMoney(categoryCounts[catName].total + item.lineTotal);
    }
  }

  const conversionRate = quotations.length > 0
    ? ((statusCounts.approved / quotations.length) * 100).toFixed(1)
    : "0";

  // ── Financial summary (P&L) ─────────────────────────────────────────────
  // Sales = confirmed contracts (status "accepted"). Paid = cash actually
  // received. Costs = expenses. Outstanding is an all-time snapshot of what
  // customers still owe across every contract (naturally a current balance).
  const [salesPeriod, paidPeriod, contractsAll, paidAll, costsPeriod] = await Promise.all([
    prisma.quotation.aggregate({ _sum: { total: true }, where: { status: "accepted", deletedAt: null, createdAt: { gte: startDate } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: startDate } } }),
    prisma.quotation.aggregate({ _sum: { total: true }, where: { status: "accepted", deletedAt: null } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { spentAt: { gte: startDate } } }),
  ]);
  const totalSales = roundMoney(salesPeriod._sum.total || 0);
  const totalPaid = roundMoney(paidPeriod._sum.amount || 0);
  const outstanding = Math.max(0, roundMoney((contractsAll._sum.total || 0) - (paidAll._sum.amount || 0)));
  const totalCosts = roundMoney(costsPeriod._sum.amount || 0);
  const netProfit = roundMoney(totalSales - totalCosts);

  // Monthly sales-vs-costs trend for the last 12 months (independent of the
  // period selector) — powers the finance chart.
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [contracts12, expenses12] = await Promise.all([
    prisma.quotation.findMany({ where: { status: "accepted", deletedAt: null, createdAt: { gte: monthStart } }, select: { total: true, createdAt: true } }),
    prisma.expense.findMany({ where: { spentAt: { gte: monthStart } }, select: { amount: true, spentAt: true } }),
  ]);
  const mKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const buckets: Record<string, { sales: number; costs: number }> = {};
  for (let i = 0; i < 12; i++) buckets[mKey(new Date(now.getFullYear(), now.getMonth() - 11 + i, 1))] = { sales: 0, costs: 0 };
  for (const c of contracts12) { const k = mKey(new Date(c.createdAt)); if (buckets[k]) buckets[k].sales += c.total; }
  for (const e of expenses12) { const k = mKey(new Date(e.spentAt)); if (buckets[k]) buckets[k].costs += e.amount; }
  const monthlyFinance = Object.entries(buckets).map(([month, v]) => ({
    month,
    sales: roundMoney(v.sales),
    costs: roundMoney(v.costs),
    profit: roundMoney(v.sales - v.costs),
  }));

  return NextResponse.json({
    finance: {
      totalSales: totalSales.toFixed(3),
      totalPaid: totalPaid.toFixed(3),
      outstanding: outstanding.toFixed(3),
      totalCosts: totalCosts.toFixed(3),
      netProfit: netProfit.toFixed(3),
    },
    monthlyFinance,
    summary: {
      totalQuotations: quotations.length,
      totalRevenue: totalRevenue.toFixed(3),
      totalApproved: totalApproved.toFixed(3),
      conversionRate,
      statusCounts,
    },
    operations: {
      deliveredCount,
      onTimeRate: deliveredWithDate > 0 ? ((onTimeCount / deliveredWithDate) * 100).toFixed(0) : null,
      avgDaysToDeliver: deliverDaysCount > 0 ? (sumDeliverDays / deliverDaysCount).toFixed(1) : null,
    },
    employeeStats: Object.values(employeeStats).sort((a, b) => b.total - a.total),
    categoryCounts: Object.values(categoryCounts).sort((a, b) => b.total - a.total),
    governorateCounts: Object.entries(governorateCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    dailyData: Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (e) {
    console.error("API error [/api/reports]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
