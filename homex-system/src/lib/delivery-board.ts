import { getSetting } from "@/lib/settings";

// The single employee allowed to use the monthly delivery board, chosen in
// Settings (empty = none). Owners (admin / ceo) can always use it too.
export async function boardEditorId(): Promise<string> {
  return (await getSetting("delivery_board_editor", "").catch(() => "")) || "";
}

// Everyone may VIEW the board. Only the owner (admin/ceo) and the one employee
// designated in Settings may EDIT it (add/remove customers, change the date,
// status or notes). Everyone else opens it read-only.
export function canEditBoard(role: string, userId: string, editorId: string): boolean {
  return role === "admin" || role === "ceo" || (!!editorId && userId === editorId);
}

export const DELIVERY_STATUSES = ["", "booked", "contacted", "delivered", "notified"] as const;
