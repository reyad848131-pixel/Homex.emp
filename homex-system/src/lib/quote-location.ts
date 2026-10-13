// Per-order location snapshot resolution.
//
// A customer is linked to all their quotations by phone and is NEVER modified on
// a new order — but the same person may order for different places. So each
// quotation can carry its own location snapshot (governorate/wilayat/address).
//
// Every screen reads the location off `quotation.customer`. To keep those screens
// unchanged while still showing the per-order place, we overlay the quote's own
// snapshot onto the `customer` object returned by each query. When the snapshot
// is null (old orders created before this feature) the customer's saved location
// shows through untouched — so there is no regression for historical data.
//
// Prisma returns a distinct `customer` object per row, so mutating it here only
// affects that one row's payload.
type QLoc = {
  governorate?: string | null;
  wilayat?: string | null;
  address?: string | null;
  customer?: { governorate?: string | null; wilayat?: string | null; address?: string | null } | null;
};

export function applyQuoteLocation<T extends QLoc>(q: T): T {
  // All-or-nothing: a quote either has its own location snapshot or it doesn't.
  // When it does (governorate/wilayat were entered for this order), take ALL
  // three fields from the quote — including a blank address — so we never mix a
  // new governorate/wilayat with the customer's stale address from another place.
  // When it has no snapshot (old orders), leave the customer's location showing.
  if (q.customer && (q.governorate || q.wilayat)) {
    q.customer.governorate = q.governorate ?? null;
    q.customer.wilayat = q.wilayat ?? null;
    q.customer.address = q.address ?? null;
  }
  return q;
}

export function applyQuoteLocations<T extends QLoc>(list: T[]): T[] {
  for (const q of list) applyQuoteLocation(q);
  return list;
}
