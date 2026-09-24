import { getSetting } from "@/lib/settings";

// Who may open the Pricing page and change default prices. Riyad and Salim (by
// civil id / login id) are permanent owners; everyone else — admins and the CEO
// included — needs to be designated in Settings.
export const PRICING_OWNER_CIVIL_IDS = ["2016", "1389"];

// Additional employees granted access to the Pricing page, chosen in Settings
// and stored as a JSON array of employee ids (empty = only the two owners).
export async function pricingEditorIds(): Promise<string[]> {
  const raw = (await getSetting("pricing_editors", "").catch(() => "")) || "";
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string" && x);
  } catch {
    // not JSON — treat as a comma list
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// Who may view/edit default prices: the two permanent owners (by civil id) plus
// any employees designated in Settings.
export function canManagePricing(civilId: string, userId: string, editorIds: string[]): boolean {
  return PRICING_OWNER_CIVIL_IDS.includes(civilId) || editorIds.includes(userId);
}
