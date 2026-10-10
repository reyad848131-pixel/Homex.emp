import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";
import { dayBounds, getAttendanceSession, isAttendanceOwner } from "@/lib/foreman";

const VALID = ["present", "absent", "onsite"];
const REASONS = ["vacation", "sick", "unexcused", "duty"];
const PERIODS = ["morning", "evening"];

async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as any;
  const ids = await foremanAccessIds().catch(() => [] as string[]);
  if (!canAccessForeman(user.civilId, user.id, ids)) return { error: NextResponse.json({ error: "غير مصرّح", code: "forbidden" }, { status: 403 }) };
  return { user };
}

// GET ?date=YYYY-MM-DD&period=morning|evening → the attendance session roster.
export async function GET(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const date = (sp.get("date") || new Date().toISOString().slice(0, 10)).trim();
    const period = PERIODS.includes(String(sp.get("period"))) ? String(sp.get("period")) : "morning";
    const data = await getAttendanceSession(date, period);
    return NextResponse.json(data);
  } catch (e) {
    console.error("API error [/api/foreman/attendance GET]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Bulk-save a whole session. { date, period, records:[{workerId,status,reason?,note?}], editNote? }
// Editing a PAST day requires an owner (Riyad/Salim) + a reason (editNote).
export async function POST(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const user = g.user as any;

    const body = await req.json().catch(() => ({}));
    const dateStr = String(body.date || "");
    const period = PERIODS.includes(String(body.period)) ? String(body.period) : "morning";
    const records: any[] = Array.isArray(body.records) ? body.records : [];
    const editNote = typeof body.editNote === "string" ? body.editNote.trim() : "";
    if (!dateStr || records.length === 0) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

    const { start } = dayBounds(dateStr);
    const todayStart = dayBounds(new Date().toISOString().slice(0, 10)).start;
    const isPast = start < todayStart;

    // Past sessions are locked: only owners may change them, and only with a reason.
    if (isPast) {
      if (!isAttendanceOwner(user.civilId)) {
        return NextResponse.json({ error: "تعديل أيام سابقة مسموح لرياض وسالم فقط", code: "owner_only" }, { status: 403 });
      }
      if (!editNote) {
        return NextResponse.json({ error: "سبب التعديل مطلوب", code: "reason_required" }, { status: 400 });
      }
    }

    const now = new Date();
    let saved = 0;
    for (const r of records) {
      const workerId = String(r.workerId || "");
      const status = VALID.includes(String(r.status)) ? String(r.status) : "present";
      if (!workerId) continue;
      const reason = status === "absent" && REASONS.includes(String(r.reason)) ? String(r.reason) : null;
      const note = typeof r.note === "string" ? r.note.slice(0, 200) : null;
      await prisma.workerAttendance.upsert({
        where: { workerId_date_period: { workerId, date: start, period } },
        update: { status, reason, note, takenBy: user.id, takenAt: now, ...(isPast ? { editNote } : {}) },
        create: { workerId, date: start, period, status, reason, note, takenBy: user.id, takenAt: now, ...(isPast ? { editNote } : {}) },
      });
      saved += 1;
    }

    if (isPast) {
      await logAction(user.id, "edit_past", "attendance", `${dateStr}/${period}`, editNote).catch(() => {});
    }

    const data = await getAttendanceSession(dateStr, period);
    return NextResponse.json({ ok: true, saved, session: data });
  } catch (e) {
    console.error("API error [/api/foreman/attendance POST]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
