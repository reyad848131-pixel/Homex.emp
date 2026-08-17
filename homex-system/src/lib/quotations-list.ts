import { prisma } from "@/lib/prisma";
import { UPCOMING_FIRST_ORDER } from "@/lib/schedule-order";
import { normalizeCredential } from "@/lib/text";

export interface QuotationListParams {
  userId: string;
  isAdmin: boolean;
  status?: string | null;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  // "recent" = newest created first (default). "delivery" = nearest delivery
  // first (overdue on top, delivered history at the bottom). "number" = by
  // quote number ascending (to verify the unified sequence in order).
  sort?: "recent" | "delivery" | "number" | null;
  page?: number;
  limit?: number;
}

// Single source of truth for the quotations list query, used by both the API
// route and the server-rendered page so the first paint has real data.
export async function getQuotationsList(p: QuotationListParams) {
  const page = Math.max(1, p.page || 1);
  const limit = Math.min(100, Math.max(1, p.limit || 20));

  const where: any = p.isAdmin ? {} : { employeeId: p.userId };
  if (p.status && p.status !== "all") where.status = p.status;
  if (p.dateFrom || p.dateTo) {
    where.createdAt = {};
    if (p.dateFrom) where.createdAt.gte = new Date(p.dateFrom);
    if (p.dateTo) where.createdAt.lte = new Date(p.dateTo + "T23:59:59.999Z");
  }
  const search = p.search ? normalizeCredential(p.search) : "";
  if (search) {
    where.OR = [
      { quoteNumber: { contains: search, mode: "insensitive" as const } },
      { originalNumber: { contains: search, mode: "insensitive" as const } },
      { customer: { name: { contains: search, mode: "insensitive" as const } } },
      { customer: { phone: { contains: search } } },
    ];
  }

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true, governorate: true } },
        employee: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy:
        p.sort === "delivery" ? UPCOMING_FIRST_ORDER
        : p.sort === "number" ? { quoteNumber: "asc" }
        // "recent": strictly newest date on top (17 → 16 → 15 …). New quotes
        // get createdAt = now(), so today's work always sits at the top.
        : { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.quotation.count({ where }),
  ]);

  return { quotations, total, page, totalPages: Math.ceil(total / limit) };
}
