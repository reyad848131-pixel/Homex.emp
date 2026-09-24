// Central production pricing — the single source of truth for the DEFAULT prices
// the quote builders start from. Values live in one place so a manager can edit
// them from the Pricing page (stored as the `pricing` setting) instead of asking
// a developer. Builders read the effective config; when nothing is stored, or a
// key is missing, these defaults apply, so behaviour never regresses.

export const BED_SIZE_KEYS = ["90x190", "100x200", "120x200", "180x200", "200x200", "220x220"] as const;

// Kitchen base rate per region (per m², before the ×unit multiplier + porcelain).
// A wilayat key wins over its governorate; a governorate not listed here has no
// automatic price (the builder asks the rep to enter it manually).
export const KITCHEN_REGION_KEYS = [
  "مسقط", "البريمي", "شمال الباطنة", "جنوب الباطنة",
  "جنوب الشرقية", "شمال الشرقية", "الظاهرة",
  "الداخلية", "بهلاء", "نزوى", "الحمراء",
] as const;

// Simple per-unit rates keyed by category id (per m² unless the id says -meter).
export const RATE_KEYS = [
  "partition", "laundry", "dressing-table", "study-table", "tv-table", "tv-table-meter",
] as const;

export interface KitchenAccessory { id: string; name: string; price: number }

export interface PricingConfig {
  cabinets: { perMeter: number };
  bed: { wood: Record<string, number>; fabric: Record<string, number> };
  sofa: { single: number; double: number; triple: number; woodenSurcharge: number };
  curtains: { chiffon: number; blackout: number; combo: number; roll: number; motorBase: number; motorPerMeter: number };
  cladding: { milamin: number; chipboard: number; light: number };
  nightstand: { round: number; standard: number };
  kitchen: { porcelain: number; base: Record<string, number>; accessories: KitchenAccessory[] };
  rates: Record<string, number>;
}

export const DEFAULT_PRICING: PricingConfig = {
  cabinets: { perMeter: 54 },
  bed: {
    wood:   { "90x190": 120, "100x200": 130, "120x200": 135, "180x200": 390, "200x200": 400, "220x220": 410 },
    fabric: { "90x190": 125, "100x200": 135, "120x200": 140, "180x200": 420, "200x200": 430, "220x220": 450 },
  },
  sofa: { single: 115, double: 230, triple: 300, woodenSurcharge: 25 },
  curtains: { chiffon: 9, blackout: 9, combo: 12.5, roll: 15, motorBase: 50, motorPerMeter: 7.5 },
  cladding: { milamin: 45, chipboard: 27, light: 20 },
  nightstand: { round: 50, standard: 30 },
  kitchen: {
    porcelain: 55,
    base: {
      "مسقط": 130, "البريمي": 150, "شمال الباطنة": 135, "جنوب الباطنة": 135,
      "جنوب الشرقية": 140, "شمال الشرقية": 140, "الظاهرة": 135,
      "الداخلية": 125, "بهلاء": 120, "نزوى": 120, "الحمراء": 120,
    },
    accessories: [
      { id: "acc-spice-drawer", name: "درج البهارات", price: 20 },
      { id: "acc-waste", name: "سلة المهملات", price: 45 },
      { id: "acc-plates-hydraulic", name: "الصحون الهيدروليك", price: 55 },
      { id: "acc-plates-fixed", name: "الصحون ثابت", price: 25 },
      { id: "acc-spice-electric", name: "البهارات الكتروني", price: 195 },
      { id: "acc-supermarket-steel", name: "سوبر ماركت ستانلس", price: 85 },
      { id: "acc-supermarket-glass", name: "سوبر ماركت زجاجي", price: 90 },
      { id: "acc-cutlery", name: "منظم الملاعق والسكاكين", price: 15 },
      { id: "acc-plates-drawer", name: "منظم الصحون (درج)", price: 50 },
    ],
  },
  rates: {
    partition: 65, laundry: 60, "dressing-table": 120, "study-table": 120,
    "tv-table": 50, "tv-table-meter": 65,
  },
};

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) && (n as number) >= 0 ? (n as number) : fallback;
};

function mergeMap(stored: any, def: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(def)) out[k] = num(stored?.[k], def[k]);
  return out;
}

// Kitchen accessories are a free-form LIST (managers add/remove/rename them), so
// a stored array replaces the default wholesale (after validation); only when no
// array is stored do the seed accessories apply.
function mergeAccessories(stored: any, def: KitchenAccessory[]): KitchenAccessory[] {
  if (!Array.isArray(stored)) return def.map((a) => ({ ...a }));
  return stored
    .filter((a) => a && typeof a === "object")
    .map((a, i) => ({
      id: typeof a.id === "string" && a.id ? a.id : `acc-${i}`,
      name: typeof a.name === "string" ? a.name.slice(0, 60) : "",
      price: num(a.price, 0),
    }))
    .filter((a) => a.name.trim());
}

// Produce a complete, validated PricingConfig by layering a stored (possibly
// partial / untrusted) object over the defaults. Unknown keys are ignored and
// every number is coerced/clamped, so a malformed stored value can never break a
// builder.
export function mergePricing(stored: any): PricingConfig {
  const s = stored && typeof stored === "object" ? stored : {};
  const d = DEFAULT_PRICING;
  return {
    cabinets: { perMeter: num(s.cabinets?.perMeter, d.cabinets.perMeter) },
    bed: {
      wood: mergeMap(s.bed?.wood, d.bed.wood),
      fabric: mergeMap(s.bed?.fabric, d.bed.fabric),
    },
    sofa: {
      single: num(s.sofa?.single, d.sofa.single),
      double: num(s.sofa?.double, d.sofa.double),
      triple: num(s.sofa?.triple, d.sofa.triple),
      woodenSurcharge: num(s.sofa?.woodenSurcharge, d.sofa.woodenSurcharge),
    },
    curtains: {
      chiffon: num(s.curtains?.chiffon, d.curtains.chiffon),
      blackout: num(s.curtains?.blackout, d.curtains.blackout),
      combo: num(s.curtains?.combo, d.curtains.combo),
      roll: num(s.curtains?.roll, d.curtains.roll),
      motorBase: num(s.curtains?.motorBase, d.curtains.motorBase),
      motorPerMeter: num(s.curtains?.motorPerMeter, d.curtains.motorPerMeter),
    },
    cladding: {
      milamin: num(s.cladding?.milamin, d.cladding.milamin),
      chipboard: num(s.cladding?.chipboard, d.cladding.chipboard),
      light: num(s.cladding?.light, d.cladding.light),
    },
    nightstand: {
      round: num(s.nightstand?.round, d.nightstand.round),
      standard: num(s.nightstand?.standard, d.nightstand.standard),
    },
    kitchen: {
      porcelain: num(s.kitchen?.porcelain, d.kitchen.porcelain),
      base: mergeMap(s.kitchen?.base, d.kitchen.base),
      accessories: mergeAccessories(s.kitchen?.accessories, d.kitchen.accessories),
    },
    rates: mergeMap(s.rates, d.rates),
  };
}

// Kitchen base rate for a governorate/wilayat from the pricing config: a wilayat
// entry wins over the governorate; an unlisted region returns null (manual).
export function kitchenBaseFor(kitchen: PricingConfig["kitchen"], governorate: string, wilayat: string): number | null {
  const b = kitchen.base || {};
  if (wilayat && b[wilayat] != null) return b[wilayat];
  if (governorate && b[governorate] != null) return b[governorate];
  return null;
}
