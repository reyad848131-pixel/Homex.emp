import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";
import { getProductionFile } from "@/lib/foreman";

// The production file: all active (إدارة الأعمال) quotes with items, full specs
// and production stages. Foreman-access only.
export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const ids = await foremanAccessIds().catch(() => [] as string[]);
    if (!canAccessForeman(user.civilId, user.id, ids)) return NextResponse.json({ error: "غير مصرّح", code: "forbidden" }, { status: 403 });

    const data = await getProductionFile();
    return NextResponse.json(data);
  } catch (e) {
    console.error("API error [/api/foreman/production GET]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
