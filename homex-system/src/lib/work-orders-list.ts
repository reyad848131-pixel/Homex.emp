import { prisma } from "@/lib/prisma";
import { VALID_WORK_STATUSES } from "@/lib/types";
import { UPCOMING_FIRST_ORDER } from "@/lib/schedule-order";
import { normalizeCredential } from "@/lib/text";

export interface WorkOrdersParams {
  workStatus?: string | null;
  hasOrange?: boolean;
  hasRed?: boolean;
  search?: string | null;
  customer?: string | null;
  deliveryFrom?: string | null;
  deliveryTo?: string | null;
  month?: string | null;
}

// Single source of truth for the work-orders / schedule query, used by the API
// route and by server-rendered pages so the board paints with real data.
export async function getWorkOrders(p: WorkOrdersParams) {
  const where: any = { deliveryDate: { not: null } };

  if (p.month) {
    const [y, m] = p.month.split("-").map(Number);
    where.deliveryDate = { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59, 999) };
  }
  if (p.workStatus && VALID_WORK_STATUSES.includes(p.workStatus)) where.workStatus = p.workStatus;
  if (p.hasOrange) where.hasOrangeAlert = true;
  if (p.hasRed) where.hasRedAlert = true;
  const search = p.search ? normalizeCredential(p.search) : "";
  if (search) {
    where.OR = [
      { quoteNumber: { contains: search, mode: "insensitive" as const } },
      { originalNumber: { contains: search, mode: "insensitive" as const } },
      { customer: { name: { contains: search, mode: "insensitive" as const } } },
    ];
  }
  if (p.customer) {
    where.customer = { ...where.customer, name: { contains: p.customer, mode: "insensitive" as const } };
  }
  if (p.deliveryFrom || p.deliveryTo) {
    where.deliveryDate = { ...where.deliveryDate };
    if (p.deliveryFrom) where.deliveryDate.gte = new Date(p.deliveryFrom);
    if (p.deliveryTo) where.deliveryDate.lte = new Date(p.deliveryTo + "T23:59:59.999Z");
  }

  const deliveryWhere = { deliveryDate: { not: null } } as const;

  const [quotations, statusCounts, totalWithDelivery, orangeCount, redCount] = await Promise.all([
    prisma.quotation.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true, address: true } },
        employee: { select: { name: true } },
        // Only the fields the board/schedule actually render — dropping the
        // per-item money fields (unitPrice/extras/lineTotal/details) noticeably
        // shrinks the payload on this list, especially on mobile.
        items: { select: { description: true, quantity: true, category: { select: { nameAr: true, nameEn: true } } }, orderBy: { sortOrder: "asc" } },
        payments: { select: { amount: true } },
      },
      orderBy: UPCOMING_FIRST_ORDER,
      // Safety cap so the list stays bounded as data grows (upcoming/overdue
      // load first; ancient delivered history beyond this isn't needed here).
      take: 1500,
    }),
    prisma.quotation.groupBy({ by: ["workStatus"], where: deliveryWhere, _count: true }),
    prisma.quotation.count({ where: deliveryWhere }),
    prisma.quotation.count({ where: { ...deliveryWhere, hasOrangeAlert: true } }),
    prisma.quotation.count({ where: { ...deliveryWhere, hasRedAlert: true } }),
  ]);

  const counts: Record<string, number> = { total: totalWithDelivery, orange: orangeCount, red: redCount };
  for (const sc of statusCounts) if (sc.workStatus) counts[sc.workStatus] = sc._count;
  counts.no_status = totalWithDelivery - statusCounts.reduce((s, c) => s + (c.workStatus ? c._count : 0), 0);

  return { quotations, counts };
}
