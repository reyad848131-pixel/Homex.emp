import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";
import { logAction } from "@/lib/audit";
import { mergeProduction } from "@/lib/production";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";

async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as any;
  const ids = await foremanAccessIds().catch(() => [] as string[]);
  if (!canAccessForeman(user.civilId, user.id, ids)) return { error: NextResponse.json({ error: "غير مصرّح", code: "forbidden" }, { status: 403 }) };
  return { user };
}

// The production structure config (stations + category pipelines).
export async function GET() {
  try {
    const g = await guard();
    if (g.error) return g.error;
    let stored: unknown = {};
    try { stored = JSON.parse((await getSetting("production", "")) || "{}"); } catch { stored = {}; }
    return NextResponse.json(mergeProduction(stored));
  } catch (e) {
    console.error("API error [/api/foreman/config GET]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const body = await req.json().catch(() => ({}));
    const clean = mergeProduction(body);
    await setSetting("production", JSON.stringify(clean));
    await logAction((g.user as any).id, "update", "production_config", undefined, JSON.stringify(clean)).catch(() => {});
    return NextResponse.json(clean);
  } catch (e) {
    console.error("API error [/api/foreman/config PUT]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
