import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { userCan } from "@/lib/permissions";

// A job may enter the photo queue only after the work is actually done.
const PHOTO_ELIGIBLE_WORK_STATUSES = ["delivered"];
const VALID_PHOTO_STATUSES = ["ready", "done"];

// Access: managers/admin/ceo, anyone with the photography permission (the
// photographer), or anyone with work_orders (so the work board's "ready for
// photo" button works). Photo mutations live here — not in /api/work-orders —
// so the photographer role (photography only) can confirm shoots.
async function canAccess(user: any) {
  return (
    user.role === "admin" ||
    user.role === "ceo" ||
    user.role === "manager" ||
    (await userCan(user.role, "photography")) ||
    (await userCan(user.role, "work_orders"))
  );
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (!(await canAccess(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const photoStatus = searchParams.get("photoStatus"); // "ready" | "done"
    const search = (searchParams.get("search") || "").trim();

    const where: any = {};
    if (photoStatus && VALID_PHOTO_STATUSES.includes(photoStatus)) {
      where.photoStatus = photoStatus;
    } else {
      where.photoStatus = { not: null };
    }
    if (search) {
      where.OR = [
        { quoteNumber: { contains: search, mode: "insensitive" } },
        { customer: { is: { name: { contains: search, mode: "insensitive" } } } },
        { customer: { is: { phone: { contains: search } } } },
      ];
    }

    const quotations = await prisma.quotation.findMany({
      where,
      // Safety cap so the queue stays bounded as delivered history grows.
      take: 800,
      orderBy: [{ photographedAt: "desc" }, { deliveredAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true, quoteNumber: true, total: true, workStatus: true,
        deliveryLocation: true, deliveryDate: true, workNotes: true,
        photoStatus: true, photographer: true, photographedAt: true, photoNotes: true,
        customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true, address: true } },
        employee: { select: { name: true } },
        items: { select: { description: true, quantity: true } },
      },
    });

    return NextResponse.json({ quotations });
  } catch (e) {
    console.error("API error [/api/photography]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (!(await canAccess(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { id, photoStatus, photographer, photoNotes } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const quotation = await prisma.quotation.findFirst({ where: { id } });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: any = {};

    if (photoStatus !== undefined) {
      if (photoStatus !== null && !VALID_PHOTO_STATUSES.includes(photoStatus)) {
        return NextResponse.json({ error: "Invalid photo status" }, { status: 400 });
      }
      // Only allow flagging "ready" once the work is delivered/installed.
      if (photoStatus === "ready" && !PHOTO_ELIGIBLE_WORK_STATUSES.includes(quotation.workStatus || "")) {
        return NextResponse.json({ error: "Job not finished yet" }, { status: 400 });
      }
      data.photoStatus = photoStatus;
      if (photoStatus === "done") {
        data.photographedAt = new Date();
      } else {
        // Back to queue (re-shoot) or unflagged: clear the completion stamp.
        data.photographedAt = null;
      }
    }

    if (photographer !== undefined) data.photographer = photographer || null;
    if (photoNotes !== undefined) data.photoNotes = (typeof photoNotes === "string" ? photoNotes.trim() : "") || null;

    const updated = await prisma.quotation.update({ where: { id }, data });
    await logAction(user.id, "photo_status_change", "quotation", id, JSON.stringify(data));

    return NextResponse.json(updated);
  } catch (e) {
    console.error("API error [/api/photography]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
