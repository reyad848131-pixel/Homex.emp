import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAuth } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";
import { logAction } from "@/lib/audit";

const KEY = "import_passcode";

// A private passcode that gates the whole import area — independent of roles,
// so even an admin/manager can't reach import (and its destructive undo)
// without it. Stored as a bcrypt hash in settings.
export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const hash = await getSetting(KEY, "");
    return NextResponse.json({ isSet: !!hash });
  } catch (e) {
    console.error("API error [/api/import/passcode GET]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const body = await req.json();
    const action = body?.action;
    const existing = await getSetting(KEY, "");

    if (action === "verify") {
      const ok = !!existing && (await bcrypt.compare(String(body.passcode || ""), existing));
      return NextResponse.json({ ok });
    }

    if (action === "set") {
      // Only admin/CEO may set or change the import passcode.
      if (user.role !== "admin" && user.role !== "ceo") {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
      }
      const next = String(body.newPasscode || "");
      if (next.length < 4) return NextResponse.json({ error: "كلمة السر قصيرة (4 أحرف على الأقل)" }, { status: 400 });
      // If one already exists, the current passcode is required to change it.
      if (existing) {
        const ok = await bcrypt.compare(String(body.currentPasscode || ""), existing);
        if (!ok) return NextResponse.json({ error: "كلمة السر الحالية غير صحيحة", code: "bad_current" }, { status: 403 });
      }
      const hash = await bcrypt.hash(next, 10);
      await setSetting(KEY, hash);
      await logAction(user.id, "update", "settings", "import_passcode", "set import passcode");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bad action" }, { status: 400 });
  } catch (e) {
    console.error("API error [/api/import/passcode POST]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
