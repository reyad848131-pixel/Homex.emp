import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";

// The foreman controls an order's wood/fabric procurement status (لم تُطلب /
// تم الطلب / وصلت). إدارة الأعمال only views it. Foreman/owner only.
const STATUSES = ["not_ordered", "ordered", "arrived"];

export async function PATCH(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; civilId: string };
  if (!canAccessForeman(user.civilId, user.id, await foremanAccessIds().catch(() => []))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const quotationId = String(body.quotationId || "");
  if (!quotationId) return NextResponse.json({ error: "quotationId مطلوب" }, { status: 400 });
  const data: Record<string, string> = {};
  if (body.woodStatus !== undefined && STATUSES.includes(body.woodStatus)) data.woodStatus = body.woodStatus;
  if (body.fabricStatus !== undefined && STATUSES.includes(body.fabricStatus)) data.fabricStatus = body.fabricStatus;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "لا تغيير" }, { status: 400 });
  // findFirst respects the soft-delete filter → can't touch a trashed quote.
  const q = await prisma.quotation.findFirst({ where: { id: quotationId }, select: { id: true } });
  if (!q) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  await prisma.quotation.update({ where: { id: quotationId }, data });
  return NextResponse.json({ ok: true, ...data });
}
