import { getSetting } from "@/lib/settings";

// Who may manage the production specs catalog (wood/fabric/colour/channel option
// lists). Riyad and Salim (by civil id) are permanent owners; the accountant
// (Deepak) and the foreman (Othman) are added by civil-id in Settings.
export const CATALOG_OWNER_CIVIL_IDS = ["2016", "1389"];

export async function catalogAccessIds(): Promise<string[]> {
  const raw = (await getSetting("catalog_access", "").catch(() => "")) || "";
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string" && x);
  } catch {
    // not JSON — treat as a comma list
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function canManageCatalog(civilId: string, userId: string, editorIds: string[]): boolean {
  return CATALOG_OWNER_CIVIL_IDS.includes(civilId) || editorIds.includes(userId);
}
