import { getSetting } from "@/lib/settings";

// The employees allowed to set or change item prices, chosen in Settings and
// stored as a JSON array of employee ids (empty = only the owner). Falls back to
// a comma-separated list for resilience.
export async function priceEditorIds(): Promise<string[]> {
  const raw = (await getSetting("price_edit_editors", "").catch(() => "")) || "";
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string" && x);
  } catch {
    // not JSON — treat as a comma list
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// The two permanent price owners — Riyad and Salim — identified by their civil
// id (login id), so the permission never depends on their role. They can always
// set / change prices and can't be removed from the settings UI. Everyone else,
// the CEO account included, is restricted unless designated in Settings.
export const PRICE_OWNER_CIVIL_IDS = ["2016", "1389"];

// Who may set or change prices in a quotation: the two permanent owners (by
// civil id) plus the employees explicitly designated in Settings. Everyone else
// — managers, system admins and even the CEO — works with the approved
// (auto-computed) prices only and may not enter a manual custom price either.
export function canEditPrice(civilId: string, userId: string, editorIds: string[]): boolean {
  return PRICE_OWNER_CIVIL_IDS.includes(civilId) || editorIds.includes(userId);
}

// Server guard mirroring the UI lock: when a user is NOT allowed to edit prices,
// they must submit only approved (auto-computed) prices. Reject the request if
// any item carries a manual price override, or a manual-category item whose
// price differs from the category's approved base price. Returns true if a
// violation is found. `catById` maps categoryId → { pricingType, basePrice }.
export function hasPriceOverride(
  items: Array<{ categoryId: string; details?: unknown; unitPrice?: unknown }>,
  catById: Map<string, { pricingType: string; basePrice: number }>
): boolean {
  for (const it of items || []) {
    let d: any = it.details;
    if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = null; } }
    if (d && (d.rateOverride != null || d.priceOverride != null)) return true;
    const cat = catById.get(it.categoryId);
    if (cat && cat.pricingType === "manual") {
      const price = typeof it.unitPrice === "string" ? parseFloat(it.unitPrice) : Number(it.unitPrice);
      if (Number.isFinite(price) && Math.abs(price - (cat.basePrice || 0)) > 0.0005) return true;
    }
  }
  return false;
}
