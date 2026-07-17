import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
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

  for (const q of quotations) {
    statusCounts[q.status] = (statusCounts[q.status] || 0) + 1;
    totalRevenue += q.total;
    if (q.status === "approved") totalApproved += q.total;

    const empKey = q.employee.name;
    if (!employeeStats[empKey]) employeeStats[empKey] = { name: empKey, count: 0, total: 0, approved: 0 };
    employeeStats[empKey].count++;
    employeeStats[empKey].total += q.total;
    if (q.status === "approved") employeeStats[empKey].approved++;

    const gov = q.customer.governorate;
    governorateCounts[gov] = (governorateCounts[gov] || 0) + 1;

    const day = q.createdAt.toISOString().split("T")[0];
    if (!dailyData[day]) dailyData[day] = { count: 0, total: 0 };
    dailyData[day].count++;
    dailyData[day].total += q.total;

    for (const item of q.items) {
      const catName = item.category.nameAr;
      if (!categoryCounts[catName]) categoryCounts[catName] = { name: catName, count: 0, total: 0 };
      categoryCounts[catName].count++;
      categoryCounts[catName].total += item.lineTotal;
    }
  }

  const conversionRate = quotations.length > 0
    ? ((statusCounts.approved / quotations.length) * 100).toFixed(1)
    : "0";

  return NextResponse.json({
    summary: {
      totalQuotations: quotations.length,
      totalRevenue: totalRevenue.toFixed(3),
      totalApproved: totalApproved.toFixed(3),
      conversionRate,
      statusCounts,
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
}
