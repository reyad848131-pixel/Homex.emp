import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getAuth } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";

const MAX_SIZE = 500 * 1024; // 500KB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

// GET is public (no auth): the OS/browser fetches the app icon for the manifest
// and home-screen shortcut, sometimes without session cookies. Returns the
// uploaded icon bytes, or redirects to the bundled default when none is set.
//
// Caching: we use "no-cache" + an ETag derived from the icon bytes, so browsers
// keep a copy but must revalidate on every request. When the admin changes the
// icon the ETag changes and the browser tab/favicon pick up the new image on
// the next load instead of showing a stale one for minutes. (An iOS home-screen
// shortcut still bakes the icon at add-time and only refreshes when re-added —
// that is an Apple limitation, not something a server header can override.)
export async function GET(req: NextRequest) {
  try {
    const icon = await getSetting("app_icon", "");
    const m = icon.match(/^data:(.+?);base64,(.+)$/);
    if (!m) {
      return NextResponse.redirect(new URL("/icons/icon-512.png", req.url));
    }
    const buffer = Buffer.from(m[2], "base64");
    const etag = `"${createHash("sha1").update(buffer).digest("hex")}"`;
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": "no-cache" },
      });
    }
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": m[1],
        "Cache-Control": "no-cache",
        ETag: etag,
      },
    });
  } catch {
    return NextResponse.redirect(new URL("/icons/icon-512.png", req.url));
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (user.role !== "admin" && user.role !== "ceo") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("icon") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "نوع الملف غير مدعوم. استخدم PNG أو JPG أو WebP" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "حجم الملف كبير جداً. الحد الأقصى 500KB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
    await setSetting("app_icon", base64);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error [/api/app-icon]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (user.role !== "admin" && user.role !== "ceo") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    await setSetting("app_icon", "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error [/api/app-icon]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
