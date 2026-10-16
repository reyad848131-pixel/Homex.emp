import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";

// Quality-control verdict on an item (pass / fail / cleared), set by the
// foreman/owner before delivery.
const STATUSES = ["pass", "fail"];

export async function PATCH(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; civilId: string };
  if (!canAccessForeman(user.civilId, user.id, await foremanAccessIds().catch(() => []))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const itemId = String(body.itemId || "");
  if (!itemId) return NextResponse.json({ error: "itemId مطلوب" }, { status: 400 });
  const clear = body.qcStatus === null || body.qcStatus === "";
  const status = String(body.qcStatus || "");
  if (!clear && !STATUSES.includes(status)) return NextResponse.json({ error: "حالة غير صحيحة" }, { status: 400 });
  const item = await prisma.quoteItem.update({
    where: { id: itemId },
    data: {
      qcStatus: clear ? null : status,
      qcNote: typeof body.qcNote === "string" ? (body.qcNote.trim() || null) : undefined,
      qcAt: clear ? null : new Date(),
      qcBy: clear ? null : user.id,
    },
    select: { id: true, qcStatus: true, qcNote: true, qcAt: true },
  });
  return NextResponse.json(item);
}
