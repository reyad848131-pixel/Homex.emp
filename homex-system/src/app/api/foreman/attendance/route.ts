import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";
import { dayBounds } from "@/lib/foreman";

const VALID = ["present", "absent", "onsite"];

// Set one worker's attendance status for a day. { workerId, date, status, note? }
export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const ids = await foremanAccessIds().catch(() => [] as string[]);
    if (!canAccessForeman(user.civilId, user.id, ids)) return NextResponse.json({ error: "غير مصرّح", code: "forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const workerId = String(body.workerId || "");
    const dateStr = String(body.date || "");
    const status = String(body.status || "present");
    if (!workerId || !dateStr || !VALID.includes(status)) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

    const date = dayBounds(dateStr).start; // normalise to local midnight
    const note = typeof body.note === "string" ? body.note.slice(0, 200) : undefined;
    const row = await prisma.workerAttendance.upsert({
      where: { workerId_date: { workerId, date } },
      update: { status, ...(note !== undefined ? { note } : {}) },
      create: { workerId, date, status, note: note || null },
    });
    return NextResponse.json(row);
  } catch (e) {
    console.error("API error [/api/foreman/attendance]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
