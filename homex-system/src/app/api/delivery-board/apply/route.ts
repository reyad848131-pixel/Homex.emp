import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { boardEditorId, canEditBoard } from "@/lib/delivery-board";

export const dynamic = "force-dynamic";

// Apply a confirmed bulk import: add the given quotations to the board with the
// given delivery dates. Editor-only. Only ids the editor confirmed are written.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };
    if (!canEditBoard(user.role, user.id, await boardEditorId())) {
      return NextResponse.json({ error: "غير مصرّح", code: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const entries: { id: string; date?: string }[] = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) return NextResponse.json({ error: "لا يوجد عناصر" }, { status: 400 });

    let applied = 0;
    for (const e of entries) {
      if (!e.id) continue;
      const data: Record<string, unknown> = { onDeliveryBoard: true };
      if (e.date) { const d = new Date(e.date); if (!isNaN(d.getTime())) { data.deliveryDate = d; data.deliveryDateEstimated = false; } }
      try { await prisma.quotation.update({ where: { id: e.id }, data }); applied++; } catch { /* skip a bad id */ }
    }
    await logAction(user.id, "delivery_board_import", "quotation", undefined, `applied ${applied}/${entries.length}`).catch(() => {});
    return NextResponse.json({ ok: true, applied });
  } catch (e) {
    console.error("API error [/api/delivery-board/apply]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
