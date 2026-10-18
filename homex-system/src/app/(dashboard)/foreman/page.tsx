import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { foremanAccessIds, canAccessForeman, FOREMAN_OWNER_CIVIL_IDS } from "@/lib/foreman-access";
import ForemanClient from "./foreman-client";

// The Foreman console — worker board, install crews and performance reports.
// Restricted to the two owners (by civil id) plus anyone designated in Settings
// (typically the foreman). Enforced here and again in every /api/foreman route.
export default async function ForemanPage() {
  const session = await getAuth();
  if (!session) redirect("/login");
  const user = session.user as { id: string; civilId: string };
  const ids = await foremanAccessIds().catch(() => [] as string[]);
  if (!canAccessForeman(user.civilId, user.id, ids)) redirect("/");
  // Owners (Riyad / Salim) see the setup sub-tabs and the reports; the foreman
  // (Othman) gets a leaner console focused on the daily work only.
  const isOwner = FOREMAN_OWNER_CIVIL_IDS.includes(user.civilId);
  return <ForemanClient isOwner={isOwner} />;
}
