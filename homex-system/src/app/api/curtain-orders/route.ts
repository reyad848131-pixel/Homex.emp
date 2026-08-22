import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/utils";
import { curtainCountFromDesc } from "@/lib/order-rules";
import { CURTAIN_WORK_STATUSES } from "@/lib/curtain-orders";

// Curtain-order tracker. Curtains are made by an external subcontractor: when a
// quotation that contains curtain items is executed (approved / accepted) it
// appears here. "ourPrice" is what the customer pays us for the curtains,
// "outsidePrice" is what the subcontractor charges us, and the difference is
// Homex's profit. The tracking row lives in CurtainOrder; everything else is
// pulled live from the quotation so the customer / date / phone stay in sync.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const statusFilter = (searchParams.get("workStatus") || "").trim();

    // Only executed quotations that actually contain curtain items.
    const rows = await prisma.quotation.findMany({
      where: {
        status: { in: ["approved", "accepted"] },
        items: { some: { category: { pricingType: "curtains" } } },
      },
      include: {
        customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true, address: true } },
        items: {
          where: { category: { pricingType: "curtains" } },
          select: { description: true, lineTotal: true, quantity: true },
        },
        curtainOrder: true,
      },
      orderBy: [{ deliveryDate: "asc" }, { contractedAt: "desc" }, { createdAt: "desc" }],
      take: 500,
    });

    const entries = rows.map((q) => {
      const curtainTotal = roundMoney(q.items.reduce((s, it) => s + (it.lineTotal || 0), 0));
      const curtainCount = q.items.reduce((s, it) => s + curtainCountFromDesc(it.description), 0);
      const co = q.curtainOrder;
      // ourPrice defaults to the curtain line totals unless overridden.
      const ourPrice = co?.ourPrice != null ? co.ourPrice : curtainTotal;
      const outsidePrice = co?.outsidePrice ?? 0;
      const difference = roundMoney(ourPrice - outsidePrice);
      return {
        id: q.id,
        quoteNumber: q.quoteNumber,
        customerName: q.customer?.name || "",
        phone: q.customer?.phone || "",
        phoneCode: q.customer?.phoneCode || "",
        region: [q.customer?.governorate, q.customer?.wilayat].filter(Boolean).join(" – ") || q.deliveryLocation || "",
        address: q.customer?.address || "",
        deliveryDate: q.deliveryDate ? q.deliveryDate.toISOString() : null,
        status: q.status,
        curtainCount,
        curtainTotal,
        advanceBillNo: co?.advanceBillNo || "",
        ourPrice: roundMoney(ourPrice),
        ourPriceOverridden: co?.ourPrice != null,
        outsidePrice: roundMoney(outsidePrice),
        difference,
        manufacturer: co?.manufacturer || "",
        workStatus: co?.workStatus || "placed",
      };
    });

    const filtered = statusFilter && (CURTAIN_WORK_STATUSES as readonly string[]).includes(statusFilter)
      ? entries.filter((e) => e.workStatus === statusFilter)
      : entries;

    // Distinct manufacturers seen so far, for the autocomplete.
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
