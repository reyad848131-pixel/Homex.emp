import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";
import { logAction } from "@/lib/audit";
import { mergePricing } from "@/lib/pricing";
import { pricingEditorIds, canManagePricing } from "@/lib/pricing-access";

// Effective default prices used by the quote builders. Readable by any signed-in
// user (the builders fetch it on load); only pricing managers may change it.
export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let stored: unknown = {};
    try { stored = JSON.parse((await getSetting("pricing", "")) || "{}"); } catch { stored = {}; }
    const res = NextResponse.json(mergePricing(stored));
    // Prices change rarely and load on every builder open — cache briefly.
    res.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    return res;
  } catch (e) {
    console.error("API error [/api/pricing GET]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;

    const editorIds = await pricingEditorIds().catch(() => [] as string[]);
    if (!canManagePricing(user.civilId, user.id, editorIds)) {
      return NextResponse.json({ error: "غير مصرّح بتعديل الأسعار", code: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // Re-validate/normalise through mergePricing so only known, numeric fields
    // are ever stored — a tampered payload can't inject arbitrary keys.
    const clean = mergePricing(body);
    await setSetting("pricing", JSON.stringify(clean));
    await logAction(user.id, "update", "pricing", undefined, JSON.stringify(clean)).catch(() => {});
    return NextResponse.json(clean);
  } catch (e) {
    console.error("API error [/api/pricing PUT]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
