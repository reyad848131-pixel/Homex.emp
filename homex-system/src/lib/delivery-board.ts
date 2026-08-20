import { getSetting } from "@/lib/settings";

// The single employee allowed to edit the monthly delivery board, chosen in
// Settings (empty = none). Owners (admin / ceo) can always edit too.
export async function boardEditorId(): Promise<string> {
  return (await getSetting("delivery_board_editor", "").catch(() => "")) || "";
}

export function canEditBoard(role: string, userId: string, editorId: string): boolean {
  return role === "admin" || role === "ceo" || (!!editorId && userId === editorId);
}

export const DELIVERY_STATUSES = ["", "booked", "contacted", "delivered", "notified"] as const;
