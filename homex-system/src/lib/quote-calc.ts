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
  // Allow fractional quantities (e.g. metres: 1.5, 3.4), rounded to 3 decimals.
  // A non-positive or invalid value falls back to 1.
  const rawQty = round3(num(item.quantity, 1));
  const quantity = rawQty > 0 ? rawQty : 1;
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

export interface QuoteTotals {
  items: SanitizedItem[];
  subtotal: number;
  discountAmount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  advancePct: number;
  advanceAmount: number;
  advanceIsFixed: boolean;
}

export interface QuoteTotalsOpts {
  // Discount taken off the grand total (post-VAT), in rials. Capped to the
  // gross total so a quote can't go negative.
  discountAmount?: number;
  // A fixed advance figure (rials) the user rounded to directly. When provided,
  // it overrides advancePct and the percentage is derived from it for display.
  advanceAmount?: number | null;
}

/**
 * Recomputes every monetary field of a quotation from its raw items plus the
 * VAT rate, advance percentage and optional discount / fixed advance. All
 * totals are derived here — never taken from the request body.
 *
 * Money model (all transparent on the document):
 *   subtotal  = Σ line totals
 *   vatAmount = subtotal × vatRate
 *   total     = subtotal + vatAmount − discountAmount
 *   advance   = fixed override, else total × advancePct%
 */
export function computeQuoteTotals(
  rawItems: RawItem[],
  vatRate: number,
  advancePct: number,
  opts: QuoteTotalsOpts = {},
): QuoteTotals {
  const items = rawItems.map((it, idx) => sanitizeItem(it, idx));
  const subtotal = round3(items.reduce((sum, it) => sum + it.lineTotal, 0));
  const safeVatRate = Math.max(0, num(vatRate, 0.05));
  const vatAmount = round3(subtotal * safeVatRate);
  const grossTotal = round3(subtotal + vatAmount);
  const discountAmount = Math.min(grossTotal, Math.max(0, round3(num(opts.discountAmount, 0))));
  const total = round3(grossTotal - discountAmount);

  let advanceIsFixed = false;
  let advanceAmount: number;
  let safeAdvancePct: number;
  if (opts.advanceAmount != null && Number.isFinite(opts.advanceAmount)) {
    advanceIsFixed = true;
    advanceAmount = Math.min(total, Math.max(0, round3(opts.advanceAmount)));
    safeAdvancePct = total > 0 ? round3((advanceAmount / total) * 100) : 0;
  } else {
    safeAdvancePct = Math.min(100, Math.max(0, num(advancePct, 15)));
    advanceAmount = round3(total * (safeAdvancePct / 100));
  }

  return {
    items,
    subtotal,
    discountAmount,
    vatRate: safeVatRate,
    vatAmount,
    total,
    advancePct: safeAdvancePct,
    advanceAmount,
    advanceIsFixed,
  };
}
