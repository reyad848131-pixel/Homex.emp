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

// Who may set or change prices in a quotation. Only the owner (CEO) and the
// employees explicitly designated in Settings — managers and system admins are
// NOT included automatically; the owner adds them to the list if wanted.
// Everyone else works with the approved (auto-computed) prices only, and may
// not enter a manual custom price either.
export function canEditPrice(role: string, userId: string, editorIds: string[]): boolean {
  return role === "ceo" || editorIds.includes(userId);
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
