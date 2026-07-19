import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";
import { logAction } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const settings = await getSettings();
    return NextResponse.json(settings);
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
