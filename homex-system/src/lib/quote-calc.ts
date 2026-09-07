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
  additionalFee: number;
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
  // Hidden "رسوم إضافية" — a flat, VAT-INCLUSIVE amount auto-added once the works
  // subtotal (pre-VAT, pre-fee) reaches `additionalFeeThreshold`. Because it is
  // VAT-inclusive, the customer's grand total rises by exactly this amount.
  additionalFeeAmount?: number;
  additionalFeeThreshold?: number;
}

// Splits a VAT-INCLUSIVE additional fee across line items for display only, so
// the customer-facing document stays internally consistent (Σ items = subtotal)
// with no visible "fee" line. Stored items remain clean; callers use this purely
// to render. The pre-VAT portion (fee ÷ (1+vat)) is spread proportionally by
// each item's share, with any rounding remainder absorbed by the largest item.
export function spreadAdditionalFee<T extends { lineTotal: number; unitPrice?: number; extras?: number; quantity?: number }>(
  items: T[],
  additionalFee: number,
  vatRate: number,
): { items: T[]; subtotal: number } {
  const base = round3(items.reduce((s, it) => s + num(it.lineTotal, 0), 0));
  const feeNet = round3(Math.max(0, num(additionalFee, 0)) / (1 + Math.max(0, num(vatRate, 0))));
  if (feeNet <= 0 || base <= 0) return { items, subtotal: base };

  let distributed = 0;
  let maxIdx = 0;
  const out = items.map((it, i) => {
    if (it.lineTotal > items[maxIdx].lineTotal) maxIdx = i;
    const share = round3(feeNet * (it.lineTotal / base));
    distributed = round3(distributed + share);
    const lineTotal = round3(it.lineTotal + share);
    const extras = num(it.extras, 0);
    const qty = num(it.quantity, 1) || 1;
    const unitPrice = it.unitPrice != null ? round3((lineTotal - extras) / qty) : it.unitPrice;
    return { ...it, lineTotal, ...(it.unitPrice != null ? { unitPrice } : {}) };
  });
  // Absorb any rounding remainder into the largest line so Σ items === subtotal.
  const remainder = round3(feeNet - distributed);
  if (remainder !== 0) {
    const it = out[maxIdx];
    const lineTotal = round3(it.lineTotal + remainder);
    const extras = num(it.extras, 0);
    const qty = num(it.quantity, 1) || 1;
    out[maxIdx] = { ...it, lineTotal, ...(it.unitPrice != null ? { unitPrice: round3((lineTotal - extras) / qty) } : {}) };
  }
  return { items: out, subtotal: round3(base + feeNet) };
}

/**
 * Recomputes every monetary field of a quotation from its raw items plus the
 * VAT rate, advance percentage and optional discount / fixed advance. All
 * totals are derived here — never taken from the request body.
 *
 * Money model:
 *   subtotal   = Σ line totals (stored clean — the fee is NOT baked in here)
 *   feeNet     = additionalFee ÷ (1 + vatRate)   (0 unless subtotal ≥ threshold)
 *   vatAmount  = (subtotal + feeNet) × vatRate
 *   total      = subtotal + feeNet + vatAmount − discountAmount
 *   advance    = fixed override, else total × advancePct%
 * The additional fee is VAT-inclusive, so `total` rises by exactly additionalFee.
 * It carries no visible line — spreadAdditionalFee() folds it into item prices
 * for the customer-facing render.
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

  // Hidden additional fee: a flat, VAT-inclusive amount added once the works
  // subtotal reaches the threshold. Its pre-VAT portion joins the taxable base
  // so the customer's grand total rises by exactly `additionalFee`.
  const feeAmount = Math.max(0, round3(num(opts.additionalFeeAmount, 0)));
  const feeThreshold = Math.max(0, num(opts.additionalFeeThreshold, 0));
  const additionalFee = feeAmount > 0 && feeThreshold > 0 && subtotal >= feeThreshold ? feeAmount : 0;
  const feeNet = round3(additionalFee / (1 + safeVatRate));

  const taxableBase = round3(subtotal + feeNet);
  const vatAmount = round3(taxableBase * safeVatRate);
  const grossTotal = round3(taxableBase + vatAmount);
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
    additionalFee,
    total,
    advancePct: safeAdvancePct,
    advanceAmount,
    advanceIsFixed,
  };
}
