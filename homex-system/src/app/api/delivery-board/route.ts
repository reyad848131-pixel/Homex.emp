import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/utils";
import { normalizeCredential } from "@/lib/text";
import { boardEditorId, canAccessBoard } from "@/lib/delivery-board";

// Monthly delivery board: a curated, one-editor organisational view of
// deliveries. Data is pulled live from the quotations, so it always reflects
// the real customer / amount / dates, and edits made here (via the [id] route)
// write straight back to the quotation and show everywhere.

export const dynamic = "force-dynamic";

function entryShape(q: any) {
  const paid = roundMoney((q.payments || []).reduce((s: number, p: any) => s + p.amount, 0));
  return {
    id: q.id,
    quoteNumber: q.quoteNumber,
    customerName: q.customer?.name || "",
    phone: q.customer?.phone || "",
    phoneCode: q.customer?.phoneCode || "",
    governorate: q.customer?.governorate || "",
    wilayat: q.customer?.wilayat || "",
    address: q.customer?.address || "",
    region: q.deliveryLocation || [q.customer?.governorate, q.customer?.wilayat].filter(Boolean).join(" – "),
    deliveryDate: q.deliveryDate ? q.deliveryDate.toISOString() : null,
    deliveryTime: q.deliveryTime || "",
    deliveryStatus: q.deliveryStatus || "",
    workNotes: q.workNotes || "",
    status: q.status,
    itemCount: q._count?.items ?? 0,
    total: q.total,
    advanceAmount: q.advanceAmount,
    paid,
    remaining: roundMoney(Math.max(q.total - paid, 0)),
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };
    const { searchParams } = new URL(req.url);

    const editorId = await boardEditorId();
    if (!canAccessBoard(user.role, user.id, editorId)) {
      return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
    }
    const canEdit = true; // anyone who can reach the board can edit it

    // Search mode: find quotations to add to the board (by name / number / phone).
    const q = (searchParams.get("q") || "").trim();
    if (q) {
      const norm = normalizeCredential(q);
      const results = await prisma.quotation.findMany({
        where: {
          OR: [
            { quoteNumber: { contains: norm, mode: "insensitive" } },
            { originalNumber: { contains: norm, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { phone: { contains: norm } } },
          ],
        },
        select: {
          id: true, quoteNumber: true, onDeliveryBoard: true, deliveryDate: true,
          total: true, customer: { select: { name: true, phone: true, phoneCode: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      });
      return NextResponse.json({
        results: results.map((r) => ({
          id: r.id, quoteNumber: r.quoteNumber, onDeliveryBoard: r.onDeliveryBoard,
          customerName: r.customer?.name || "", phone: r.customer?.phone || "",
          phoneCode: r.customer?.phoneCode || "", total: r.total,
          deliveryDate: r.deliveryDate ? r.deliveryDate.toISOString() : null,
        })),
      });
    }

    // Board mode: entries for the given month (YYYY-MM), plus any board entries
    // that don't have a date yet (so they never silently disappear).
    const month = searchParams.get("month") || "";
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    const now = new Date();
    const year = m ? parseInt(m[1], 10) : now.getFullYear();
    const mon = m ? parseInt(m[2], 10) - 1 : now.getMonth();
    const start = new Date(year, mon, 1);
    const end = new Date(year, mon + 1, 1);

    const rows = await prisma.quotation.findMany({
      where: {
        onDeliveryBoard: true,
        OR: [
          { deliveryDate: { gte: start, lt: end } },
          { deliveryDate: null },
        ],
      },
      include: {
        customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true, address: true } },
        payments: { select: { amount: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ deliveryDate: "asc" }, { deliveryTime: "asc" }],
      take: 400,
    });

    const entries = rows.map(entryShape);
    return NextResponse.json({
      canEdit,
      editorId,
      month: `${year}-${String(mon + 1).padStart(2, "0")}`,
      scheduled: entries.filter((e) => e.deliveryDate),
      unscheduled: entries.filter((e) => !e.deliveryDate),
    });
  } catch (e) {
    console.error("API error [/api/delivery-board]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
