import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";

async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as { role: string };
  if (!(await userCan(user.role, "work_orders"))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

// POST: add a production stage to one item ({ quoteItemId, stage, workerId? })
// or the same stage to many at once ({ quoteItemIds: string[], stage }) — the
// "apply to all items" action. Returns the created task, or an array of them.
export async function POST(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const body = await req.json();
    const stage = String(body.stage || "").trim();
    const ids: string[] = Array.isArray(body.quoteItemIds)
      ? body.quoteItemIds.map(String).filter(Boolean)
      : body.quoteItemId ? [String(body.quoteItemId)] : [];
    if (!stage || ids.length === 0) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

    // Next free sortOrder per item, so a bulk-added stage lands at each end.
    const lasts = await prisma.itemTask.groupBy({
      by: ["quoteItemId"],
      where: { quoteItemId: { in: ids } },
      _max: { sortOrder: true },
    });
    const nextOrder = new Map(lasts.map((l) => [l.quoteItemId, (l._max.sortOrder ?? -1) + 1]));

    const created = [];
    for (const quoteItemId of ids) {
      const task = await prisma.itemTask.create({
        data: {
          quoteItemId,
          stage,
          workerId: body.workerId || null,
          sortOrder: nextOrder.get(quoteItemId) ?? 0,
        },
        include: { worker: true },
      });
      created.push(task);
    }
    const single = !Array.isArray(body.quoteItemIds);
    return NextResponse.json(single ? created[0] : created, { status: 201 });
  } catch (e) {
    console.error("API error [/api/item-tasks POST]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH: assign a worker and/or mark the stage done. { id, workerId?, done?, stage? }
export async function PATCH(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const body = await req.json();
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const data: Record<string, unknown> = {};
    if ("workerId" in body) data.workerId = body.workerId || null;
    if (typeof body.stage === "string" && body.stage.trim()) data.stage = body.stage.trim();
    if (typeof body.done === "boolean") data.doneAt = body.done ? new Date() : null;

    const task = await prisma.itemTask.update({ where: { id }, data, include: { worker: true } });
    return NextResponse.json(task);
  } catch (e) {
    console.error("API error [/api/item-tasks PATCH]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE: remove a stage. ?id=
export async function DELETE(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const id = req.nextUrl.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await prisma.itemTask.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error("API error [/api/item-tasks DELETE]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
