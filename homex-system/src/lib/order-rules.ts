// Business rules shared between the UI builders and the server so validation
// stays consistent in one place.

// Wilayats that get the reduced curtain minimum.
const CURTAIN_LOW_MIN_WILAYATS = ["بهلاء", "نزوى", "الحمراء"];

/**
 * Minimum number of curtains allowed for an order, based on the customer's
 * wilayat: 5 for Bahla / Nizwa / Al Hamra, 8 everywhere else.
 */
export function curtainMinCount(wilayat: string | null | undefined): number {
  return CURTAIN_LOW_MIN_WILAYATS.includes((wilayat || "").trim()) ? 5 : 8;
}
