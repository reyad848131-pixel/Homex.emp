import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { CURTAIN_WORK_STATUSES } from "@/lib/curtain-orders";
import { normalizeCredential } from "@/lib/text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// WRITE step for the curtain-order import. Takes the previewed rows and creates
// them: LINKED rows upsert a CurtainOrder onto the matched quotation; STANDALONE
// rows create a CurtainOrder with no quotation, carrying their own customer data.

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isFinite(n) && n >= 0 ? n : null;
};
const ws = (v: unknown): string => {
  const s = String(v || "placed");
  return (CURTAIN_WORK_STATUSES as readonly string[]).includes(s) ? s : "placed";
};

export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string };

    const body = await req.json().catch(() => ({}));
    const rows: any[] = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0) return NextResponse.json({ error: "لا يوجد صفوف" }, { status: 400 });

    let linked = 0, standalone = 0;
    for (const r of rows) {
      const pricing = {
        advanceBillNo: String(r.advanceBillNo || "").trim() || null,
        ourPrice: num(r.ourPrice),
        outsidePrice: num(r.outsidePrice) ?? 0,
        manufacturer: String(r.manufacturer || "").trim() || null,
        workStatus: ws(r.workStatus),
      };

      if (r.status === "linked" && r.quotationId) {
        const q = await prisma.quotation.findUnique({ where: { id: r.quotationId }, select: { id: true } });
        if (!q) continue;
        await prisma.curtainOrder.upsert({
          where: { quotationId: r.quotationId },
          create: { quotationId: r.quotationId, ...pricing },
          update: pricing,
        });
        linked++;
      } else {
        await prisma.curtainOrder.create({
          data: {
            ...pricing,
            custName: String(r.name || "").trim() || null,
            custPhone: normalizeCredential(String(r.phone || "")) || null,
            place: String(r.place || "").trim() || null,
            deliveryDate: r.date ? new Date(r.date) : null,
            curtainCount: num(r.curtainCount) != null ? Math.round(num(r.curtainCount)!) : null,
          },
        });
        standalone++;
      }
    }

    await logAction(user.id, "curtain_order_import", "curtain_order", undefined, JSON.stringify({ linked, standalone })).catch(() => {});
    return NextResponse.json({ ok: true, linked, standalone });
  } catch (e) {
    console.error("API error [/api/curtain-orders/apply]:", e);
    return NextResponse.json({ error: "تعذّر الاستيراد" }, { status: 500 });
  }
}
