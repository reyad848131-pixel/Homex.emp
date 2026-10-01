import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";
import { getProductionConfig } from "@/lib/foreman";
import { pipelineFor, stationForStage } from "@/lib/production";

// Create an item's production stages from its category pipeline, auto-assigning
// each stage to the responsible station's main worker. By default only seeds an
// item that has no stages yet; pass { replace: true } to clear and re-apply.
// { quoteItemId, replace? } for one item, or { quotationId, replace? } to apply
// to every item of a whole quote at once.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const ids = await foremanAccessIds().catch(() => [] as string[]);
    if (!canAccessForeman(user.civilId, user.id, ids)) return NextResponse.json({ error: "غير مصرّح", code: "forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const replace = body.replace === true;

    const where = body.quotationId
      ? { quotationId: String(body.quotationId) }
      : body.quoteItemId
      ? { id: String(body.quoteItemId) }
      : null;
    if (!where) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

    const items = await prisma.quoteItem.findMany({
      where,
      select: { id: true, categoryId: true, _count: { select: { tasks: true } } },
    });
    if (items.length === 0) return NextResponse.json({ error: "لا توجد أصناف" }, { status: 404 });

    const config = await getProductionConfig();
    let createdCount = 0;

    for (const it of items) {
      if (it._count.tasks > 0 && !replace) continue;
      if (replace && it._count.tasks > 0) {
        // Only clear stages not yet marked done, so finished work isn't lost.
        await prisma.itemTask.deleteMany({ where: { quoteItemId: it.id, doneAt: null } });
      }
      const stages = pipelineFor(config, it.categoryId);
      const existing = new Set(
        (await prisma.itemTask.findMany({ where: { quoteItemId: it.id }, select: { stage: true } })).map((t) => t.stage)
      );
      let order = (await prisma.itemTask.aggregate({ where: { quoteItemId: it.id }, _max: { sortOrder: true } }))._max.sortOrder ?? -1;
      for (const stage of stages) {
        if (existing.has(stage)) continue; // don't duplicate a stage already present
        order += 1;
        const station = stationForStage(config, stage);
        await prisma.itemTask.create({
          data: { quoteItemId: it.id, stage, workerId: station?.mainWorkerId || null, sortOrder: order },
        });
        createdCount += 1;
      }
    }

    return NextResponse.json({ ok: true, created: createdCount });
  } catch (e) {
    console.error("API error [/api/foreman/apply-pipeline POST]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
