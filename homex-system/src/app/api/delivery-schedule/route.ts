import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getDeliverySchedule } from "@/lib/work-orders-list";
import { canViewFieldOps } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Orders placed on the delivery schedule (by dispatchDate), for the calendar and
// the per-day list. Independent of the work board's deliveryDate.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (!(await canViewFieldOps(user.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const deliveredParam = searchParams.get("delivered");
    const result = await getDeliverySchedule({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      search: searchParams.get("search"),
      delivered: deliveredParam === "1" ? true : deliveredParam === "0" ? false : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("API error [/api/delivery-schedule]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
