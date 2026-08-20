import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { boardEditorId, canAccessBoard } from "@/lib/delivery-board";
import DeliveryBoardClient from "./board-client";

// The delivery board is private: only the owner (admin/ceo) and the single
// employee designated in Settings may open it. Everyone else is redirected
// away — they never see the page or its data.
export default async function DeliveryBoardPage() {
  const session = await getAuth();
  const user = session?.user as { id: string; role: string } | undefined;
  if (!user) redirect("/login");
  const editorId = await boardEditorId();
  if (!canAccessBoard(user.role, user.id, editorId)) redirect("/");
  return <DeliveryBoardClient />;
}
