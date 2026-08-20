import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VALID_WORK_STATUSES } from "@/lib/types";
import { logAction } from "@/lib/audit";
import { getWorkOrders } from "@/lib/work-orders-list";
import { canViewFieldOps, canEditFieldOps } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (!(await canViewFieldOps(user.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const result = await getWorkOrders({
      workStatus: searchParams.get("workStatus"),
      hasOrange: searchParams.get("hasOrange") === "true",
      hasRed: searchParams.get("hasRed") === "true",
      search: searchParams.get("search"),
      customer: searchParams.get("customer"),
      deliveryFrom: searchParams.get("deliveryFrom"),
      deliveryTo: searchParams.get("deliveryTo"),
      month: searchParams.get("month"),
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("API error [/api/work-orders]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (!(await canEditFieldOps(user.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { id, workStatus, hasOrangeAlert, hasRedAlert, workNotes, woodStatus, fabricStatus,
      deliveryDriver, apptConfirmed, deliveryDate, deliveryTime, deliveryLocation, deliveryDays } = body;

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const quotation = await prisma.quotation.findFirst({ where: { id } });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: any = {};
    const validMaterialStatuses = ["not_ordered", "ordered", "arrived"];

    if (workStatus !== undefined) {
      if (workStatus !== null && !VALID_WORK_STATUSES.includes(workStatus)) {
        return NextResponse.json({ error: "Invalid work status" }, { status: 400 });
      }
      data.workStatus = workStatus;
      if (workStatus === "delivered") {
        data.hasRedAlert = false;
        if (!quotation.deliveredAt) data.deliveredAt = new Date();
      }
    }

    if (hasOrangeAlert !== undefined) data.hasOrangeAlert = Boolean(hasOrangeAlert);
    if (hasRedAlert !== undefined) data.hasRedAlert = Boolean(hasRedAlert);
    if (workNotes !== undefined) data.workNotes = workNotes;
    if (deliveryDriver !== undefined) data.deliveryDriver = deliveryDriver || null;
    if (deliveryLocation !== undefined) data.deliveryLocation = (typeof deliveryLocation === "string" ? deliveryLocation.trim() : "") || null;
    if (apptConfirmed !== undefined) data.apptConfirmed = Boolean(apptConfirmed);
    if (deliveryDate !== undefined) {
      data.deliveryDate = deliveryDate ? new Date(deliveryDate) : null;
      // Rescheduling with a real date confirms it — drop any import estimate.
      data.deliveryDateEstimated = false;
    }
    if (deliveryTime !== undefined) data.deliveryTime = deliveryTime || null;
    if (deliveryDays !== undefined) data.deliveryDays = Math.max(1, Math.min(14, parseInt(String(deliveryDays), 10) || 1));
    if (woodStatus !== undefined && validMaterialStatuses.includes(woodStatus)) data.woodStatus = woodStatus;
    if (fabricStatus !== undefined && validMaterialStatuses.includes(fabricStatus)) data.fabricStatus = fabricStatus;

    if (data.woodStatus !== undefined || data.fabricStatus !== undefined) {
      const current = { woodStatus: quotation.woodStatus, fabricStatus: quotation.fabricStatus, ...data };
      if (current.woodStatus === "arrived" || current.fabricStatus === "arrived") {
        data.workStatus = "ready_to_execute";
      } else if (quotation.workStatus === "ready_to_execute") {
        data.workStatus = "needs_preparation";
      }
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data,
      include: { customer: true, employee: { select: { name: true } } },
    });

    await logAction(user.id, "work_status_change", "quotation", id, JSON.stringify(data));

    return NextResponse.json(updated);
  } catch (e) {
    console.error("API error [/api/work-orders]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
