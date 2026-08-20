import { getSetting } from "@/lib/settings";

// The single employee allowed to use the monthly delivery board, chosen in
// Settings (empty = none). Owners (admin / ceo) can always use it too.
export async function boardEditorId(): Promise<string> {
  return (await getSetting("delivery_board_editor", "").catch(() => "")) || "";
}

// The board is private: ONLY the owner (admin/ceo) and the one designated
// employee may reach it — not managers, not anyone else — and whoever can reach
// it can also edit it. Everyone else has no access at all (not even view).
export function canAccessBoard(role: string, userId: string, editorId: string): boolean {
  return role === "admin" || role === "ceo" || (!!editorId && userId === editorId);
}

export const DELIVERY_STATUSES = ["", "booked", "contacted", "delivered", "notified"] as const;
