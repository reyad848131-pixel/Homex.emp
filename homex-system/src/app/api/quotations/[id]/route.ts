import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      employee: { select: { id: true, name: true, civilId: true } },
      items: { include: { category: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(quotation);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const { id } = await params;
  const body = await req.json();

  if (body.status) {
    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role === "sales" && ["approved", "declined"].includes(body.status)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: body,
    include: { customer: true, items: { include: { category: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const { id } = await params;

  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "sales" && quotation.employeeId !== user.id) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  await prisma.quotation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
