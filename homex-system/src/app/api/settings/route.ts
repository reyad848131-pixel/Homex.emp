import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";
import { logAction } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const settings = await getSettings();
    // Strip the heavy base64 logo blob from the general settings payload: it can
    // be hundreds of KB and is downloaded on every quotation view / new-quote
    // page, none of which display it. The Settings editor loads it separately
    // via /api/logo, and server-side rendering (public quote, PDF) reads it
    // straight from getSettings(). Keeping it out of this response makes those
    // hot pages noticeably faster.
    const light = { ...settings };
    delete light.company_logo;
    const res = NextResponse.json(light);
    res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=120");
    return res;
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    for (const [key, value] of Object.entries(body)) {
      await setSetting(key, String(value));
    }

    await logAction(user.id, "update", "settings", undefined, JSON.stringify(body));
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
