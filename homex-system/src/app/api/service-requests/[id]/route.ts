import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const data: any = {};

    if (body.status !== undefined && ["open", "scheduled", "resolved"].includes(body.status)) {
      data.status = body.status;
      data.resolvedAt = body.status === "resolved" ? new Date() : null;
    }
    if (body.scheduledDate !== undefined) data.scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : null;
    if (body.technician !== undefined) data.technician = body.technician || null;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.reason !== undefined) data.reason = body.reason || null;

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data,
      include: {
        quotation: { select: { id: true, quoteNumber: true, customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } } } },
      },
    });

    await logAction(user.id, "update", "service_request", id, JSON.stringify(data));
    return NextResponse.json(updated);
  } catch (e) {
    console.error("API error [/api/service-requests/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    await prisma.serviceRequest.delete({ where: { id } });
    await logAction(user.id, "delete", "service_request", id, "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error [/api/service-requests/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
