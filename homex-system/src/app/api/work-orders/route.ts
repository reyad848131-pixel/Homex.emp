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

    const where: any = {
      deliveryDate: { not: null },
    };

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

    const quotations = await prisma.quotation.findMany({
      where,
      include: {
        customer: true,
        employee: { select: { name: true } },
        items: { include: { category: true }, orderBy: { sortOrder: "asc" } },
      },
      orderBy: { deliveryDate: "asc" },
    });

    const statusCounts = await prisma.quotation.groupBy({
      by: ["workStatus"],
      where: { deliveryDate: { not: null } },
      _count: true,
    });

    const totalWithDelivery = await prisma.quotation.count({
      where: { deliveryDate: { not: null } },
    });

    const orangeCount = await prisma.quotation.count({
      where: { deliveryDate: { not: null }, hasOrangeAlert: true },
    });

    const redCount = await prisma.quotation.count({
      where: { deliveryDate: { not: null }, hasRedAlert: true },
    });

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
    const { id, workStatus, hasOrangeAlert, hasRedAlert, workNotes } = body;

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: any = {};

    if (workStatus !== undefined) {
      if (workStatus !== null && !VALID_WORK_STATUSES.includes(workStatus)) {
        return NextResponse.json({ error: "Invalid work status" }, { status: 400 });
      }
      data.workStatus = workStatus;
      if (workStatus === "delivered") {
        data.hasRedAlert = false;
      }
    }

    if (hasOrangeAlert !== undefined) data.hasOrangeAlert = Boolean(hasOrangeAlert);
    if (hasRedAlert !== undefined) data.hasRedAlert = Boolean(hasRedAlert);
    if (workNotes !== undefined) data.workNotes = workNotes;

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
