import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";
import { logAction } from "@/lib/audit";
import { mergeSpecsCatalog } from "@/lib/specs-catalog";
import { catalogAccessIds, canManageCatalog } from "@/lib/catalog-access";

// The production specs catalog. Readable by any signed-in user (the quote
// builders fetch it to populate the spec dropdowns); only catalog managers
// (owners + designated) may change it.
export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let stored: unknown = {};
    try { stored = JSON.parse((await getSetting("specs_catalog", "")) || "{}"); } catch { stored = {}; }
    const res = NextResponse.json(mergeSpecsCatalog(stored));
    // Changes rarely, loaded on every builder open — cache briefly.
    res.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    return res;
  } catch (e) {
    console.error("API error [/api/catalog GET]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;

    const editorIds = await catalogAccessIds().catch(() => [] as string[]);
    if (!canManageCatalog(user.civilId, user.id, editorIds)) {
      return NextResponse.json({ error: "غير مصرّح بتعديل الكتالوج", code: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const clean = mergeSpecsCatalog(body);
    await setSetting("specs_catalog", JSON.stringify(clean));
    await logAction(user.id, "update", "specs_catalog", undefined, JSON.stringify(clean)).catch(() => {});
    return NextResponse.json(clean);
  } catch (e) {
    console.error("API error [/api/catalog PUT]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
