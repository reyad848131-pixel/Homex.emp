import { getSetting } from "@/lib/settings";

// Who may open the Foreman console (worker board, install crews, reports).
// Riyad and Salim (by civil id) always; plus anyone designated in Settings —
// typically the foreman (Othman).
export const FOREMAN_OWNER_CIVIL_IDS = ["2016", "1389"];

export async function foremanAccessIds(): Promise<string[]> {
  const raw = (await getSetting("foreman_access", "").catch(() => "")) || "";
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string" && x);
  } catch {
    // not JSON — treat as a comma list
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function canAccessForeman(civilId: string, userId: string, editorIds: string[]): boolean {
  return FOREMAN_OWNER_CIVIL_IDS.includes(civilId) || editorIds.includes(userId);
}
