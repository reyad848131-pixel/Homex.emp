import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { parseBody, customerUpdateSchema } from "@/lib/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const { id } = await params;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "sales" && customer.createdBy !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = parseBody(customerUpdateSchema, await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
    const body = parsed.data;

    const data: Record<string, any> = {};
    if (body.name) data.name = body.name;
    if (body.phone) data.phone = body.phone;
    if (body.phoneCode) data.phoneCode = body.phoneCode;
    if (body.governorate) data.governorate = body.governorate;
    if (body.wilayat) data.wilayat = body.wilayat;
    if (body.address !== undefined) data.address = body.address || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.customer.update({ where: { id }, data });
    await logAction(user.id, "update", "customer", id);

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
