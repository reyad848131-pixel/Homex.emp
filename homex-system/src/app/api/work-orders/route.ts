import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VALID_WORK_STATUSES } from "@/lib/types";
import { logAction } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const isAdmin = user.role === "admin" || user.role === "manager";
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const workStatus = searchParams.get("workStatus");
    const hasOrange = searchParams.get("hasOrange");
    const hasRed = searchParams.get("hasRed");
    const search = searchParams.get("search");
    const customer = searchParams.get("customer");
    const deliveryFrom = searchParams.get("deliveryFrom");
    const deliveryTo = searchParams.get("deliveryTo");
    const month = searchParams.get("month");

    const where: any = {
      deliveryDate: { not: null },
    };

    if (month) {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      where.deliveryDate = { gte: start, lte: end };
    }

    if (workStatus && VALID_WORK_STATUSES.includes(workStatus)) {
      where.workStatus = workStatus;
    }

    if (hasOrange === "true") {
      where.hasOrangeAlert = true;
    }

    if (hasRed === "true") {
      where.hasRedAlert = true;
    }

    if (search) {
      where.OR = [
        { quoteNumber: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (customer) {
      where.customer = { ...where.customer, name: { contains: customer, mode: "insensitive" } };
    }

    if (deliveryFrom || deliveryTo) {
      where.deliveryDate = { ...where.deliveryDate };
      if (deliveryFrom) where.deliveryDate.gte = new Date(deliveryFrom);
      if (deliveryTo) where.deliveryDate.lte = new Date(deliveryTo + "T23:59:59.999Z");
    }

    const deliveryWhere = { deliveryDate: { not: null } } as const;

    const [quotations, statusCounts, totalWithDelivery, orangeCount, redCount] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true, address: true } },
          employee: { select: { name: true } },
          items: { include: { category: { select: { nameAr: true, nameEn: true } } }, orderBy: { sortOrder: "asc" } },
          payments: { select: { amount: true } },
        },
        orderBy: [{ deliveryDate: "asc" }, { deliveryTime: "asc" }],
      }),
      prisma.quotation.groupBy({
        by: ["workStatus"],
        where: deliveryWhere,
        _count: true,
      }),
      prisma.quotation.count({ where: deliveryWhere }),
      prisma.quotation.count({ where: { ...deliveryWhere, hasOrangeAlert: true } }),
      prisma.quotation.count({ where: { ...deliveryWhere, hasRedAlert: true } }),
    ]);

    const counts: Record<string, number> = {
      total: totalWithDelivery,
      orange: orangeCount,
      red: redCount,
    };
    for (const sc of statusCounts) {
      if (sc.workStatus) counts[sc.workStatus] = sc._count;
    }
    counts.no_status = totalWithDelivery - statusCounts.reduce((s, c) => s + (c.workStatus ? c._count : 0), 0);

    return NextResponse.json({ quotations, counts });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const isAdmin = user.role === "admin" || user.role === "manager";
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { id, workStatus, hasOrangeAlert, hasRedAlert, workNotes, woodStatus, fabricStatus,
      deliveryDriver, apptConfirmed, deliveryDate, deliveryTime, deliveryLocation,
      installTechnician, installDate, installTime } = body;

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const quotation = await prisma.quotation.findUnique({ where: { id } });
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
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
