import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/utils";
import { curtainCountFromDesc } from "@/lib/order-rules";
import { CURTAIN_WORK_STATUSES } from "@/lib/curtain-orders";
import { normalizeCredential } from "@/lib/text";
import { logAction } from "@/lib/audit";

// Curtain-order tracker. Curtains are made by an external subcontractor:
//  - LINKED rows come live from any quotation that contains curtain items (a
//    quotation with a kitchen + cabinets + curtains contributes only its
//    curtains here). They appear as soon as the quote is saved (any status
//    except declined).
//  - STANDALONE rows are historical / external orders with no quotation (e.g.
//    imported from the old Excel).
// "ourPrice" is what the customer pays us for the curtains, "outsidePrice" is
// what the supplier charges us, and the difference is Homex's profit.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const statusFilter = (searchParams.get("workStatus") || "").trim();

    // Quotations that contain curtain items — shown from the moment they're saved
    // (any status except a declined one).
    const quotes = await prisma.quotation.findMany({
      where: {
        status: { not: "declined" },
        items: { some: { category: { pricingType: "curtains" } } },
      },
      include: {
        customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true, address: true } },
        items: {
          where: { category: { pricingType: "curtains" } },
          select: { description: true, lineTotal: true },
        },
        curtainOrder: true,
      },
      orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
      take: 800,
    });

    const linked = quotes.map((q) => {
      const curtainTotal = roundMoney(q.items.reduce((s, it) => s + (it.lineTotal || 0), 0));
      const curtainCount = q.items.reduce((s, it) => s + curtainCountFromDesc(it.description), 0);
      const co = q.curtainOrder;
      const ourPrice = co?.ourPrice != null ? co.ourPrice : curtainTotal;
      const outsidePrice = co?.outsidePrice ?? 0;
      return {
        id: q.id, // linked rows are keyed by their quotation id
        kind: "quote" as const,
        quotationId: q.id,
        quoteNumber: q.quoteNumber,
        customerName: q.customer?.name || "",
        phone: q.customer?.phone || "",
        phoneCode: q.customer?.phoneCode || "",
        region: [q.customer?.governorate, q.customer?.wilayat].filter(Boolean).join(" – ") || q.deliveryLocation || "",
        deliveryDate: q.deliveryDate ? q.deliveryDate.toISOString() : null,
        status: q.status,
        curtainCount,
        curtainTotal,
        advanceBillNo: co?.advanceBillNo || "",
        ourPrice: roundMoney(ourPrice),
        ourPriceOverridden: co?.ourPrice != null,
        outsidePrice: roundMoney(outsidePrice),
        difference: roundMoney(ourPrice - outsidePrice),
        manufacturer: co?.manufacturer || "",
        workStatus: co?.workStatus || "placed",
      };
    });

    // Standalone rows (imported / external) — no quotation.
    const standaloneRows = await prisma.curtainOrder.findMany({
      where: { quotationId: null },
      orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
      take: 800,
    });
    const standalone = standaloneRows.map((co) => {
      const ourPrice = co.ourPrice ?? 0;
      const outsidePrice = co.outsidePrice ?? 0;
      return {
        id: co.id, // standalone rows are keyed by their own id
        kind: "standalone" as const,
        quotationId: null,
        quoteNumber: "",
        customerName: co.custName || "",
        phone: co.custPhone || "",
        phoneCode: co.custPhoneCode || "",
        region: co.place || "",
        deliveryDate: co.deliveryDate ? co.deliveryDate.toISOString() : null,
        status: "",
        curtainCount: co.curtainCount ?? 0,
        curtainTotal: roundMoney(ourPrice),
        advanceBillNo: co.advanceBillNo || "",
        ourPrice: roundMoney(ourPrice),
        ourPriceOverridden: co.ourPrice != null,
        outsidePrice: roundMoney(outsidePrice),
        difference: roundMoney(ourPrice - outsidePrice),
        manufacturer: co.manufacturer || "",
        workStatus: co.workStatus || "placed",
      };
    });

    let entries = [...linked, ...standalone];
    // Sort: dated first (ascending), then undated.
    entries.sort((a, b) => {
      if (a.deliveryDate && b.deliveryDate) return a.deliveryDate.localeCompare(b.deliveryDate);
      if (a.deliveryDate) return -1;
      if (b.deliveryDate) return 1;
      return 0;
    });

    const filtered = statusFilter && (CURTAIN_WORK_STATUSES as readonly string[]).includes(statusFilter)
      ? entries.filter((e) => e.workStatus === statusFilter)
      : entries;

    const manufacturers = Array.from(
      new Set(entries.map((e) => e.manufacturer).filter(Boolean))
    ).sort();

    const summary = {
      count: filtered.length,
      totalOur: roundMoney(filtered.reduce((s, e) => s + e.ourPrice, 0)),
      totalOutside: roundMoney(filtered.reduce((s, e) => s + e.outsidePrice, 0)),
      totalProfit: roundMoney(filtered.reduce((s, e) => s + e.difference, 0)),
      totalCurtains: filtered.reduce((s, e) => s + e.curtainCount, 0),
    };

    return NextResponse.json({ entries: filtered, manufacturers, summary });
  } catch (e) {
    console.error("API error [/api/curtain-orders]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Create a single STANDALONE curtain order (manual add — no quotation).
export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string };
    const body = await req.json().catch(() => ({}));
    const n = (v: unknown): number | null => { if (v == null || v === "") return null; const x = Number(v); return isFinite(x) && x >= 0 ? x : null; };
    const created = await prisma.curtainOrder.create({
      data: {
        custName: String(body.customerName || "").trim() || null,
        custPhone: normalizeCredential(String(body.phone || "")) || null,
        custPhoneCode: String(body.phoneCode || "").trim() || null,
        place: String(body.region || "").trim() || null,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        curtainCount: n(body.curtainCount) != null ? Math.round(n(body.curtainCount)!) : null,
        advanceBillNo: String(body.advanceBillNo || "").trim() || null,
        ourPrice: n(body.ourPrice),
        outsidePrice: n(body.outsidePrice) ?? 0,
        manufacturer: String(body.manufacturer || "").trim() || null,
        workStatus: (CURTAIN_WORK_STATUSES as readonly string[]).includes(String(body.workStatus)) ? String(body.workStatus) : "placed",
      },
    });
    await logAction(user.id, "curtain_order_create", "curtain_order", created.id).catch(() => {});
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (e) {
    console.error("API error [/api/curtain-orders] POST:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
