import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUS_MAP } from "@/lib/types";
import { roundMoney } from "@/lib/utils";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await getAuth();
  const userId = (session?.user as any)?.id;
  const role = (session?.user as any)?.role;

  const isAdmin = role === "admin" || role === "manager";
  const whereClause = isAdmin ? {} : { employeeId: userId };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [totalQuotes, totalCustomers, quotations, monthlyQuotes, statusGroupBy, expiringQuotations, revenueAgg, collectedAgg] = await Promise.all([
    prisma.quotation.count({ where: whereClause }),
    prisma.customer.count({ where: isAdmin ? {} : { createdBy: userId } }),
    prisma.quotation.findMany({
      where: whereClause,
      include: { customer: true, employee: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.quotation.count({ where: { ...whereClause, createdAt: { gte: monthStart } } }),
    prisma.quotation.groupBy({
      by: ["status"],
      where: whereClause,
      _count: true,
    }),
    prisma.quotation.findMany({
      where: {
        ...whereClause,
        status: { in: ["draft", "pending", "revised"] },
        validUntil: { not: null, lte: sevenDaysFromNow },
      },
      include: { customer: true },
      orderBy: { validUntil: "asc" },
      take: 5,
    }),
    prisma.quotation.aggregate({
      where: { ...whereClause, status: "approved" },
      _sum: { total: true },
    }),
    prisma.payment.aggregate({
      where: { quotation: { ...whereClause, status: "approved" } },
      _sum: { amount: true },
    }),
  ]);

  const statusMap = Object.fromEntries(statusGroupBy.map((s) => [s.status, s._count]));
  const draftCount = statusMap.draft || 0;
  const pendingCount = statusMap.pending || 0;
  const approvedCount = statusMap.approved || 0;
  const declinedCount = statusMap.declined || 0;
  const revisedCount = statusMap.revised || 0;

  const totalRevenue = revenueAgg._sum.total || 0;
  const collectedAmount = roundMoney(collectedAgg._sum.amount || 0);
  const outstandingAmount = roundMoney(Math.max(totalRevenue - collectedAmount, 0));
  const conversionRate = totalQuotes > 0 ? ((approvedCount / totalQuotes) * 100).toFixed(0) : "0";

  const data = {
    userName: session?.user?.name || "",
    isAdmin,
    totalQuotes,
    totalCustomers,
    monthlyQuotes,
    draftCount,
    pendingCount,
    approvedCount,
    declinedCount,
    revisedCount,
    totalRevenue,
    collectedAmount,
    outstandingAmount,
    conversionRate,
    expiringQuotations: expiringQuotations.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      customerName: q.customer.name,
      daysLeft: Math.ceil((new Date(q.validUntil!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    })),
    quotations: quotations.map((q) => {
      const status = STATUS_MAP[q.status] || STATUS_MAP.draft;
      return {
        id: q.id,
        quoteNumber: q.quoteNumber,
        customerName: q.customer.name,
        employeeName: q.employee.name,
        status: q.status,
        statusLabel: status.label,
        statusColor: status.color,
        itemCount: q._count.items,
        total: q.total,
        createdAt: q.createdAt.toISOString(),
      };
    }),
  };

  return <DashboardClient data={data} />;
}
