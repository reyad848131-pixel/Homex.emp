// Server-side quotation math. Single source of truth used by both the create
// (POST /api/quotations) and edit (PATCH /api/quotations/[id]) routes so the
// server never trusts monetary totals sent by the client.

import { roundMoney } from "./utils";

const round3 = roundMoney;

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
};

export interface RawItem {
  categoryId: string;
  description?: string;
  details?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  extras?: unknown;
  lineTotal?: unknown;
  [key: string]: unknown;
}

export interface SanitizedItem {
  categoryId: string;
  description: string;
  details: string | null;
  quantity: number;
  unitPrice: number;
  extras: number;
  lineTotal: number;
  sortOrder: number;
}

/**
 * Sanitizes and RE-COMPUTES a single line item. The incoming `lineTotal` is
 * ignored and derived from quantity/unitPrice/extras, so a tampered total sent
 * from the client cannot lower (or inflate) the amount that gets stored.
 */
export function sanitizeItem(item: RawItem, sortOrder: number): SanitizedItem {
  const quantity = Math.max(1, Math.round(num(item.quantity, 1)));
  const unitPrice = Math.max(0, num(item.unitPrice, 0));
  const extras = Math.max(0, num(item.extras, 0));
  const lineTotal = round3(quantity * unitPrice + extras);

  return {
    categoryId: item.categoryId,
    description: typeof item.description === "string" ? item.description : "",
    details: item.details != null ? JSON.stringify(item.details) : null,
    quantity,
    unitPrice: round3(unitPrice),
    extras: round3(extras),
    lineTotal,
    sortOrder,
  };
}

export interface Discount {
  type?: string; // "percent" | "amount"
  value?: unknown;
}

export interface QuoteTotals {
  items: SanitizedItem[];
  subtotal: number;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  advancePct: number;
  advanceAmount: number;
}

/**
 * Recomputes every monetary field of a quotation from its raw items plus the
 * VAT rate, advance percentage, and an optional discount. The discount is
 * applied to the subtotal before VAT. All totals are derived here — never
 * taken from the request body.
 */
export function computeQuoteTotals(
  rawItems: RawItem[],
  vatRate: number,
  advancePct: number,
  discount?: Discount
): QuoteTotals {
  const items = rawItems.map((it, idx) => sanitizeItem(it, idx));
  const subtotal = round3(items.reduce((sum, it) => sum + it.lineTotal, 0));

  // Discount on the subtotal (percent of subtotal, or a fixed amount), clamped
  // so it can never be negative or exceed the subtotal.
  const discountType = discount?.type === "amount" ? "amount" : "percent";
  const discountValue = Math.max(0, num(discount?.value, 0));
  const rawDiscount =
    discountType === "amount"
      ? discountValue
      : subtotal * (Math.min(discountValue, 100) / 100);
  const discountAmount = round3(Math.min(Math.max(rawDiscount, 0), subtotal));
  const discountedSubtotal = round3(subtotal - discountAmount);

  const safeVatRate = Math.max(0, num(vatRate, 0.05));
  const vatAmount = round3(discountedSubtotal * safeVatRate);
  const total = round3(discountedSubtotal + vatAmount);
  const safeAdvancePct = Math.min(100, Math.max(0, num(advancePct, 15)));
  const advanceAmount = round3(total * (safeAdvancePct / 100));

  return {
    items,
    subtotal,
    discountType,
    discountValue: round3(discountValue),
    discountAmount,
    vatRate: safeVatRate,
    vatAmount,
    total,
    advancePct: safeAdvancePct,
    advanceAmount,
  };
}
