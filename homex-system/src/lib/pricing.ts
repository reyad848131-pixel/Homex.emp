// Central production pricing — the single source of truth for the DEFAULT prices
// the quote builders start from. Values live in one place so a manager can edit
// them from the Pricing page (stored as the `pricing` setting) instead of asking
// a developer. Builders read the effective config; when nothing is stored, or a
// key is missing, these defaults apply, so behaviour never regresses.

export const BED_SIZE_KEYS = ["90x190", "100x200", "120x200", "180x200", "200x200", "220x220"] as const;

export interface PricingConfig {
  // Cabinets (خزائن): price per square metre (width × height × rate).
  cabinets: { perMeter: number };
  // Beds (أسرّة): price per frame type and mattress size.
  bed: { wood: Record<string, number>; fabric: Record<string, number> };
  // Seating sets (أطقم الجلوس): per-piece prices + the wooden-frame surcharge.
  sofa: { single: number; double: number; triple: number; woodenSurcharge: number };
}

export const DEFAULT_PRICING: PricingConfig = {
  cabinets: { perMeter: 54 },
  bed: {
    wood:   { "90x190": 120, "100x200": 130, "120x200": 135, "180x200": 390, "200x200": 400, "220x220": 410 },
    fabric: { "90x190": 125, "100x200": 135, "120x200": 140, "180x200": 420, "200x200": 430, "220x220": 450 },
  },
  sofa: { single: 115, double: 230, triple: 300, woodenSurcharge: 25 },
};

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) && (n as number) >= 0 ? (n as number) : fallback;
};

function mergeSizes(stored: any, def: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(def)) out[k] = num(stored?.[k], def[k]);
  return out;
}

// Produce a complete, validated PricingConfig by layering a stored (possibly
// partial / untrusted) object over the defaults. Unknown keys are ignored and
// every number is coerced/clamped, so a malformed stored value can never break a
// builder.
export function mergePricing(stored: any): PricingConfig {
  const s = stored && typeof stored === "object" ? stored : {};
  return {
    cabinets: { perMeter: num(s.cabinets?.perMeter, DEFAULT_PRICING.cabinets.perMeter) },
    bed: {
      wood: mergeSizes(s.bed?.wood, DEFAULT_PRICING.bed.wood),
      fabric: mergeSizes(s.bed?.fabric, DEFAULT_PRICING.bed.fabric),
    },
    sofa: {
      single: num(s.sofa?.single, DEFAULT_PRICING.sofa.single),
      double: num(s.sofa?.double, DEFAULT_PRICING.sofa.double),
      triple: num(s.sofa?.triple, DEFAULT_PRICING.sofa.triple),
      woodenSurcharge: num(s.sofa?.woodenSurcharge, DEFAULT_PRICING.sofa.woodenSurcharge),
    },
  };
}
