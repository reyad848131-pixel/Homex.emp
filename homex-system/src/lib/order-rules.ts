// Business rules shared between the UI builders and the server so validation
// stays consistent in one place.

import { normalizeDigits } from "./text";

// Wilayats that get the reduced curtain minimum.
const CURTAIN_LOW_MIN_WILAYATS = ["بهلاء", "نزوى", "الحمراء"];

/**
 * Minimum number of curtains allowed for an order, based on the customer's
 * wilayat: 5 for Bahla / Nizwa / Al Hamra, 8 everywhere else.
 */
export function curtainMinCount(wilayat: string | null | undefined): number {
  return CURTAIN_LOW_MIN_WILAYATS.includes((wilayat || "").trim()) ? 5 : 8;
}

// Curtain items carry their count in the description, e.g.
// "ستائر شيفون (6 ستارة) - 2×2م = 4 م²". Extract that count. Arabic-Indic
// digits are folded to ASCII first so "(٦ ستارة)" can't sneak past the check.
export function curtainCountFromDesc(description: string | null | undefined): number {
  const d = normalizeDigits(description || "");
  const m = d.match(/\((\d+)\s*ستارة\)/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Check a set of quote items against the wilayat's curtain minimum. Returns the
 * first offending item's count + the required minimum, or null when all curtain
 * items satisfy the rule. Used by BOTH the create and edit routes so the
 * minimum can't be bypassed by editing an order after it's created.
 */
export function findCurtainViolation(
  items: Array<{ description?: string | null }>,
  wilayat: string | null | undefined
): { count: number; min: number } | null {
  const min = curtainMinCount(wilayat);
  for (const it of items || []) {
    const n = curtainCountFromDesc(it.description);
    if (n > 0 && n < min) return { count: n, min };
  }
  return null;
}
