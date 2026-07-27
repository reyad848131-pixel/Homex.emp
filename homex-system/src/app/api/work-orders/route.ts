import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VALID_WORK_STATUSES } from "@/lib/types";
import { logAction } from "@/lib/audit";
import { getWorkOrders } from "@/lib/work-orders-list";
import { userCan } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const allowed = (user.role === "admin" || user.role === "ceo") || user.role === "manager" || await userCan(user.role, "work_orders");
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    const allowed = (user.role === "admin" || user.role === "ceo") || user.role === "manager" || await userCan(user.role, "work_orders");
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { id, workStatus, hasOrangeAlert, hasRedAlert, workNotes, woodStatus, fabricStatus,
      deliveryDriver, apptConfirmed, deliveryDate, deliveryTime, deliveryLocation,
      installTechnician, installDate, installTime } = body;

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
      if (workStatus === "installed" && !quotation.installedAt) {
        data.installedAt = new Date();
      }
    }

    if (hasOrangeAlert !== undefined) data.hasOrangeAlert = Boolean(hasOrangeAlert);
    if (hasRedAlert !== undefined) data.hasRedAlert = Boolean(hasRedAlert);
    if (workNotes !== undefined) data.workNotes = workNotes;
    if (deliveryDriver !== undefined) data.deliveryDriver = deliveryDriver || null;
    if (deliveryLocation !== undefined) data.deliveryLocation = (typeof deliveryLocation === "string" ? deliveryLocation.trim() : "") || null;
    if (apptConfirmed !== undefined) data.apptConfirmed = Boolean(apptConfirmed);
    if (deliveryDate !== undefined) data.deliveryDate = deliveryDate ? new Date(deliveryDate) : null;
    if (deliveryTime !== undefined) data.deliveryTime = deliveryTime || null;
    if (installTechnician !== undefined) data.installTechnician = installTechnician || null;
    if (installDate !== undefined) data.installDate = installDate ? new Date(installDate) : null;
    if (installTime !== undefined) data.installTime = installTime || null;
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
