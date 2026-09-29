import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";
import { dayBounds } from "@/lib/foreman";

async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as any;
  const ids = await foremanAccessIds().catch(() => [] as string[]);
  if (!canAccessForeman(user.civilId, user.id, ids)) return { error: NextResponse.json({ error: "غير مصرّح", code: "forbidden" }, { status: 403 }) };
  return { user };
}

// Create/update the install crew for a job on a day. { quotationId, date, requiredCount?, notes? }
export async function POST(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const body = await req.json().catch(() => ({}));
    const quotationId = String(body.quotationId || "");
    const dateStr = String(body.date || "");
    if (!quotationId || !dateStr) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    const { start, end } = dayBounds(dateStr);

    const existing = await prisma.installCrew.findFirst({ where: { quotationId, date: { gte: start, lte: end } } });
    const requiredCount = body.requiredCount != null ? Math.max(0, Math.round(Number(body.requiredCount) || 0)) : undefined;
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : undefined;

    const crew = existing
      ? await prisma.installCrew.update({ where: { id: existing.id }, data: { ...(requiredCount !== undefined ? { requiredCount } : {}), ...(notes !== undefined ? { notes } : {}) } })
      : await prisma.installCrew.create({ data: { quotationId, date: start, requiredCount: requiredCount ?? 1, notes: notes || null } });

    return NextResponse.json({ id: crew.id, requiredCount: crew.requiredCount, notes: crew.notes });
  } catch (e) {
    console.error("API error [/api/foreman/crew POST]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Add or remove a worker from a crew. { crewId, add?: workerId, remove?: workerId }
export async function PATCH(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const body = await req.json().catch(() => ({}));
    const crewId = String(body.crewId || "");
    if (!crewId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

    if (body.add) {
      await prisma.crewMember.upsert({
        where: { crewId_workerId: { crewId, workerId: String(body.add) } },
        update: {},
        create: { crewId, workerId: String(body.add) },
      });
    }
    if (body.remove) {
      await prisma.crewMember.deleteMany({ where: { crewId, workerId: String(body.remove) } });
    }
    const members = await prisma.crewMember.findMany({
      where: { crewId },
      include: { worker: { select: { id: true, name: true, color: true } } },
    });
    return NextResponse.json({ members: members.map((m) => ({ workerId: m.workerId, name: m.worker?.name || "", color: m.worker?.color || "#999" })) });
  } catch (e) {
    console.error("API error [/api/foreman/crew PATCH]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
