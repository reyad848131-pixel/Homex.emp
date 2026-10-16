import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";
import { getLiveFloor } from "@/lib/foreman";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; civilId: string };
  if (!canAccessForeman(user.civilId, user.id, await foremanAccessIds().catch(() => []))) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  return NextResponse.json(await getLiveFloor());
}
