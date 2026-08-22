import { getSetting } from "@/lib/settings";

// The two permanent settings owners — Riyad and Salim — by civil id (login id).
// They can always open Settings and can't be removed. Everyone else, admins and
// the CEO included, has no access unless designated in Settings.
export const SETTINGS_OWNER_CIVIL_IDS = ["2016", "1389"];

// Additional employees granted access to Settings, chosen in Settings and stored
// as a JSON array of employee ids (empty = only the two owners).
export async function settingsAccessIds(): Promise<string[]> {
  const raw = (await getSetting("settings_access_editors", "").catch(() => "")) || "";
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string" && x);
  } catch {
    // not JSON — treat as a comma list
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// Who may open the Settings page and save settings: the two permanent owners
// (by civil id) plus any employees designated in Settings.
export function canAccessSettings(civilId: string, userId: string, editorIds: string[]): boolean {
  return SETTINGS_OWNER_CIVIL_IDS.includes(civilId) || editorIds.includes(userId);
}
