import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";
import { getForemanBoard, getForemanInstalls } from "@/lib/foreman";

export const dynamic = "force-dynamic";

async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as any;
  const ids = await foremanAccessIds().catch(() => [] as string[]);
  if (!canAccessForeman(user.civilId, user.id, ids)) {
    return { error: NextResponse.json({ error: "غير مصرّح", code: "forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const date = (req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10)).trim();
    const [board, installs] = await Promise.all([getForemanBoard(date), getForemanInstalls(date)]);
    return NextResponse.json({ date, ...board, installs });
  } catch (e) {
    console.error("API error [/api/foreman]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
