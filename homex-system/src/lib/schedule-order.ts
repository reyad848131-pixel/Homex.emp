import type { Prisma } from "@prisma/client";

// Shared "upcoming first" ordering for delivery-oriented lists (the work board,
// the delivery schedule, and the quotations list's "nearest delivery" sort).
// It realizes the "القادم أولاً + المتأخر فوق" model chosen by the user:
//   1) deliveredAt NULLS FIRST → orders not yet delivered come first, and
//      already-delivered history sinks to the bottom.
//   2) deliveryDate ASC NULLS LAST → within the pending block, the most overdue
//      (oldest past date) is pinned on top, then today, then the future in
//      order; rows with no date yet fall to the end of the block.
//   3) deliveryTime ASC → same-day deliveries ordered by time.
// Because it's expressed purely as Prisma orderBy, it also paginates correctly.
export const UPCOMING_FIRST_ORDER: Prisma.QuotationOrderByWithRelationInput[] = [
  { deliveredAt: { sort: "asc", nulls: "first" } },
  { deliveryDate: { sort: "asc", nulls: "last" } },
  { deliveryTime: "asc" },
];
