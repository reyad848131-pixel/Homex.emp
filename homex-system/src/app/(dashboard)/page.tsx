import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { STATUS_MAP } from "@/lib/types";
import { roundMoney } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { getRolePermissions } from "@/lib/permissions";
import { DashboardClient } from "./dashboard-client";
import { FieldDashboard } from "./field-dashboard";
import { ReadinessBanner } from "@/components/readiness-banner";

// Essential company settings that should be filled before quoting.
const READINESS_KEYS = ["company_name", "company_logo", "company_phone", "vat_rate", "terms_conditions"];

export default async function DashboardPage() {
  const session = await getAuth();
  const userId = (session?.user as any)?.id;
  const role = (session?.user as any)?.role;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Field roles (driver / photographer) get a focused dashboard pointing them
  // straight to their work — no quote stats or money they can't act on.
  if (role === "driver" || role === "photographer") {
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const pending = { deliveredAt: null, workStatus: { notIn: ["delivered"] } };
    const [todayDeliveries, overdueDeliveries, photoQueue] = await Promise.all([
      prisma.quotation.count({ where: { ...pending, deliveryDate: { gte: startOfDay, lt: endOfDay } } }),
      prisma.quotation.count({ where: { ...pending, deliveryDate: { lt: startOfDay } } }),
      prisma.quotation.count({ where: { photoStatus: "ready" } }),
    ]);
    return (
      <FieldDashboard
        userName={session?.user?.name || ""}
        role={role}
        todayDeliveries={todayDeliveries}
        overdueDeliveries={overdueDeliveries}
        photoQueue={photoQueue}
      />
    );
  }

  const isAdmin = role === "admin" || role === "ceo" || role === "manager";
  const whereClause = isAdmin ? {} : { employeeId: userId };

  // Roles without financial access (driver / photographer) never see money.
  const canSeeFinancials = isAdmin || ((await getRolePermissions(role).catch(() => [])) as string[]).includes("financials");

  // Only admins/CEO configure settings, so only they see the readiness nudge.
  const missingSettings = (role === "admin" || role === "ceo")
    ? await getSettings().then((s) => READINESS_KEYS.filter((k) => !s[k] || !String(s[k]).trim()))
    : [];

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = startOfDay;

  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [totalQuotes, totalCustomers, quotations, monthlyQuotes, statusGroupBy, expiringQuotations, revenueAgg, collectedAgg, photoQueueCount, overdueDeliveries, estimatedDateCount] = await Promise.all([
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
    // Jobs waiting to be photographed (global — the queue isn't per-employee).
    prisma.quotation.count({ where: { photoStatus: "ready" } }),
    // Deliveries whose date has passed but haven't been delivered/installed yet.
    prisma.quotation.count({
      where: {
        ...whereClause,
        deliveryDate: { lt: startOfToday },
        deliveredAt: null,
        workStatus: { notIn: ["delivered"] },
      },
    }),
    // Orders still carrying an estimated (unconfirmed) delivery date.
    isAdmin ? prisma.quotation.count({ where: { deliveryDateEstimated: true } }) : Promise.resolve(0),
  ]);

  // Top outstanding receivables (approved orders with a remaining balance),
  // for roles that can see money. Computed in one grouped query.
  const topReceivables = canSeeFinancials
    ? ((await prisma.$queryRaw(Prisma.sql`
        SELECT q.id, q.quote_number AS "quoteNumber", q.total::float AS total,
               COALESCE(SUM(p.amount), 0)::float AS paid, c.name AS "customerName"
        FROM quotations q
        JOIN customers c ON c.id = q.customer_id
        LEFT JOIN payments p ON p.quotation_id = q.id
        WHERE q.status = 'approved' AND q.deleted_at IS NULL
          ${isAdmin ? Prisma.empty : Prisma.sql`AND q.employee_id = ${userId}`}
        GROUP BY q.id, c.name
        HAVING q.total > COALESCE(SUM(p.amount), 0)
        ORDER BY (q.total - COALESCE(SUM(p.amount), 0)) DESC
        LIMIT 8
      `)) as Array<{ id: string; quoteNumber: string; total: number; paid: number; customerName: string }>)
        .map((r) => ({ ...r, remaining: roundMoney(r.total - r.paid) }))
    : [];

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

  // Pending website enquiries awaiting follow-up.
  const newLeadsCount = await prisma.lead.count({ where: { status: "new" } }).catch(() => 0);

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
    photoQueueCount,
    overdueDeliveries,
    estimatedDateCount,
    newLeadsCount,
    canSeeFinancials,
    topReceivables,
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

  return (
    <>
      <ReadinessBanner missing={missingSettings} />
      <DashboardClient data={data} />
    </>
  );
}
