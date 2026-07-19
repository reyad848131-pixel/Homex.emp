import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employees = await prisma.employee.findMany({
    select: {
      id: true, name: true, civilId: true, phone: true,
      role: true, isActive: true, createdAt: true,
      _count: { select: { quotations: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { name, civilId, phone, role, password } = body;

  if (!name || !civilId || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.employee.findUnique({ where: { civilId } });
  if (existing) {
    return NextResponse.json({ error: "Civil ID already exists" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const employee = await prisma.employee.create({
    data: { name, civilId, phone: phone || null, role: role || "sales", password: hashedPassword },
    select: { id: true, name: true, civilId: true, phone: true, role: true, isActive: true },
  });

  await logAction(user.id, "create", "employee", employee.id, JSON.stringify({ name, civilId, role }));
  return NextResponse.json(employee, { status: 201 });
}
