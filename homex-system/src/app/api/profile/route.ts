import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, civilId: true, phone: true, role: true, createdAt: true },
    });

    return NextResponse.json(employee);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const body = await req.json();

    if (body.action === "change-password") {
      if (!body.currentPassword || !body.newPassword) {
        return NextResponse.json({ error: "كلمة المرور مطلوبة" }, { status: 400 });
      }
      if (body.newPassword.length < 4) {
        return NextResponse.json({ error: "كلمة المرور يجب أن تكون 4 أحرف على الأقل" }, { status: 400 });
      }

      const employee = await prisma.employee.findUnique({ where: { id: user.id } });
      if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const valid = await bcrypt.compare(body.currentPassword, employee.password);
      if (!valid) {
        return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 });
      }

      const hashed = await bcrypt.hash(body.newPassword, 10);
      await prisma.employee.update({
        where: { id: user.id },
        data: { password: hashed },
      });

      return NextResponse.json({ success: true });
    }

    if (body.phone !== undefined) {
      await prisma.employee.update({
        where: { id: user.id },
        data: { phone: body.phone },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
