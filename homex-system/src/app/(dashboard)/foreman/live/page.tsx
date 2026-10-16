import { notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";
import { LiveFloorClient } from "./live-client";

// Live shop-floor view (#13) — foreman/owner only. Suited for a wall display.
export default async function LiveFloorPage() {
  const session = await getAuth();
  const user = session?.user as { id: string; civilId: string } | undefined;
  if (!user || !canAccessForeman(user.civilId, user.id, await foremanAccessIds().catch(() => []))) notFound();
  return <LiveFloorClient />;
}
