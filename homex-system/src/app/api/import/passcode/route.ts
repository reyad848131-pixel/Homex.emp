import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAuth } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";
import { logAction } from "@/lib/audit";

const KEY = "import_passcode";
// Owner-only recovery key: a second secret, set once and kept somewhere safe.
// If the import passcode is forgotten it can be reset with this key WITHOUT
// knowing the current passcode — so the owner is never locked out, while anyone
// who doesn't know the recovery key (managers included) still can't reset it.
const KEY_RECOVERY = "import_passcode_recovery";

// A private passcode that gates the whole import area — independent of roles,
// so even an admin/manager can't reach import (and its destructive undo)
// without it. Stored as a bcrypt hash in settings.
export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const hash = await getSetting(KEY, "");
    const recovery = await getSetting(KEY_RECOVERY, "");
    return NextResponse.json({ isSet: !!hash, hasRecovery: !!recovery });
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
      await setSetting(KEY, await bcrypt.hash(next, 10));
      // Optionally set/update the recovery key in the same step.
      const recoveryKey = String(body.recoveryKey || "");
      if (recoveryKey) {
        if (recoveryKey.length < 8) return NextResponse.json({ error: "مفتاح الاسترجاع قصير (8 أحرف على الأقل)" }, { status: 400 });
        await setSetting(KEY_RECOVERY, await bcrypt.hash(recoveryKey, 10));
      }
      await logAction(user.id, "update", "settings", "import_passcode", "set import passcode");
      return NextResponse.json({ ok: true });
    }

    if (action === "reset") {
      // Forgot-passcode recovery: reset it using the recovery key, without the
      // current passcode. Admin/CEO role required as an extra layer.
      if (user.role !== "admin" && user.role !== "ceo") {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
      }
      const recovery = await getSetting(KEY_RECOVERY, "");
      if (!recovery) return NextResponse.json({ error: "لا يوجد مفتاح استرجاع معيّن", code: "no_recovery" }, { status: 400 });
      const ok = await bcrypt.compare(String(body.recoveryKey || ""), recovery);
      if (!ok) return NextResponse.json({ error: "مفتاح الاسترجاع غير صحيح", code: "bad_recovery" }, { status: 403 });
      const next = String(body.newPasscode || "");
      if (next.length < 4) return NextResponse.json({ error: "كلمة السر قصيرة (4 أحرف على الأقل)" }, { status: 400 });
      await setSetting(KEY, await bcrypt.hash(next, 10));
      await logAction(user.id, "update", "settings", "import_passcode", "reset import passcode via recovery key");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bad action" }, { status: 400 });
  } catch (e) {
    console.error("API error [/api/import/passcode POST]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
