import { prisma } from "@/lib/prisma";
import { VALID_WORK_STATUSES } from "@/lib/types";
import { UPCOMING_FIRST_ORDER } from "@/lib/schedule-order";
import { normalizeCredential } from "@/lib/text";
import { applyQuoteLocations } from "@/lib/quote-location";

export interface WorkOrdersParams {
  workStatus?: string | null;
  hasOrange?: boolean;
  hasRed?: boolean;
  search?: string | null;
  customer?: string | null;
  // deliveryFrom/deliveryTo filter by the DELIVERY date (used by the contract
  // availability hint and the delivery-calendar day picker).
  deliveryFrom?: string | null;
  deliveryTo?: string | null;
  // boardFrom/boardTo (and month) filter by the FROZEN boardMonth — the work
  // board's own month navigation, independent of the delivery date.
  boardFrom?: string | null;
  boardTo?: string | null;
  month?: string | null;
}

// One-time heal: the old "completed" (مكتمل) status was merged into
// "ready_for_delivery" (جاهز). Migrate any leftover rows once per server
// instance — idempotent and cheap (indexed, no matches after the first run).
let mergedCompleted = false;
async function healCompletedStatus() {
  if (mergedCompleted) return;
  mergedCompleted = true;
  try { await prisma.quotation.updateMany({ where: { workStatus: "completed" }, data: { workStatus: "ready_for_delivery" } }); }
  catch { mergedCompleted = false; }
}

// One-time backfill: the work board switched from grouping by deliveryDate to a
// FIXED boardMonth (frozen at contract time). Seed boardMonth for existing board
// rows from contractedAt (when it was contracted) or, failing that, createdAt —
// so historical orders keep sitting under the month they were actually taken,
// not under their delivery date. Runs once per server instance; fills NULLs only.
let boardMonthBackfilled = false;
async function backfillBoardMonth() {
  if (boardMonthBackfilled) return;
  boardMonthBackfilled = true;
  try {
    await prisma.$executeRaw`UPDATE "quotations" SET "board_month" = COALESCE("contracted_at", "created_at") WHERE "delivery_date" IS NOT NULL AND "board_month" IS NULL`;
  } catch { boardMonthBackfilled = false; }
}

// Single source of truth for the work-orders / schedule query, used by the API
// route and by server-rendered pages so the board paints with real data.
export async function getWorkOrders(p: WorkOrdersParams) {
  await healCompletedStatus();
  await backfillBoardMonth();
  // Presence on the board is unchanged (a contracted order has a deliveryDate),
  // but the month/date navigation below filters by the FROZEN boardMonth, never
  // by deliveryDate — the work board has nothing to do with the delivery date.
  const where: any = { deliveryDate: { not: null } };

  if (p.month) {
    const [y, m] = p.month.split("-").map(Number);
    where.boardMonth = { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59, 999) };
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
  // The work board's own month navigation → the frozen boardMonth.
  if (p.boardFrom || p.boardTo) {
    where.boardMonth = { ...where.boardMonth };
    if (p.boardFrom) where.boardMonth.gte = new Date(p.boardFrom);
    if (p.boardTo) where.boardMonth.lte = new Date(p.boardTo + "T23:59:59.999Z");
  }
  // Delivery-date window (contract availability hint + delivery-calendar picker)
  // → stays on deliveryDate (keeps the base { not: null } via the spread).
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
        items: {
          select: {
            id: true, description: true, quantity: true,
            category: { select: { nameAr: true, nameEn: true } },
            // Production pipeline: each item's stages with their assigned worker.
            tasks: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true, stage: true, workerId: true, doneAt: true, sortOrder: true,
                worker: { select: { id: true, name: true, color: true } },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        payments: { select: { amount: true } },
        materialOrders: { select: { status: true } },
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

  applyQuoteLocations(quotations);
  return { quotations, counts };
}

// One-time backfill: the delivery schedule moved from deliveryDate to the new
// dispatchDate. Seed dispatchDate from deliveryDate for orders that were already
// on the schedule (ready-for-delivery / delivered) so nothing disappears when
// the split ships. Runs once per server instance; idempotent (only fills NULLs).
let dispatchBackfilled = false;
async function backfillDispatch() {
  if (dispatchBackfilled) return;
  dispatchBackfilled = true;
  try {
    await prisma.$executeRaw`UPDATE "quotations" SET "dispatch_date" = "delivery_date" WHERE "work_status" IN ('ready_for_delivery', 'delivered') AND "delivery_date" IS NOT NULL AND "dispatch_date" IS NULL`;
  } catch { dispatchBackfilled = false; }
}

// The DELIVERY SCHEDULE query — keyed off dispatchDate (the day an order was
// placed on the calendar), completely independent of the work board's
// deliveryDate. Returns the orders scheduled within [from, to]. `search` filters
// by name / number. This is what the calendar and the per-day list read.
export async function getDeliverySchedule(p: { from?: string | null; to?: string | null; search?: string | null; delivered?: boolean }) {
  await backfillDispatch();
  const where: any = { dispatchDate: { not: null } };
  if (p.from || p.to) {
    where.dispatchDate = {};
    if (p.from) where.dispatchDate.gte = new Date(p.from);
    if (p.to) where.dispatchDate.lte = new Date(p.to + "T23:59:59.999Z");
    if (!p.from) where.dispatchDate.not = null;
  }
  if (p.delivered === true) where.workStatus = "delivered";
  else if (p.delivered === false) where.workStatus = { not: "delivered" };
  const search = p.search ? normalizeCredential(p.search) : "";
  if (search) {
    where.OR = [
      { quoteNumber: { contains: search, mode: "insensitive" as const } },
      { originalNumber: { contains: search, mode: "insensitive" as const } },
      { customer: { name: { contains: search, mode: "insensitive" as const } } },
    ];
  }
  const quotations = await prisma.quotation.findMany({
    where,
    include: {
      customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true, address: true } },
      employee: { select: { name: true } },
      items: { select: { description: true, quantity: true }, orderBy: { sortOrder: "asc" } },
      payments: { select: { amount: true } },
    },
    orderBy: [{ dispatchDate: "asc" }, { deliveryTime: "asc" }],
    take: 1500,
  });
  applyQuoteLocations(quotations);
  return { quotations };
}
