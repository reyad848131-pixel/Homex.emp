import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody, changePasswordSchema } from "@/lib/schemas";
import { normalizePhone } from "@/lib/text";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, civilId: true, phone: true, phoneCode: true, role: true, createdAt: true },
    });

    return NextResponse.json(employee);
  } catch (e) {
    console.error("API error [/api/profile]:", e);
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
      const parsed = parseBody(changePasswordSchema, body);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });

      const employee = await prisma.employee.findUnique({ where: { id: user.id } });
      if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const valid = await bcrypt.compare(parsed.data.currentPassword, employee.password);
      if (!valid) {
        return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 });
      }

      const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
      await prisma.employee.update({
        where: { id: user.id },
        data: { password: hashed },
      });

      return NextResponse.json({ success: true });
    }

    if (body.phone !== undefined) {
      await prisma.employee.update({
        where: { id: user.id },
        data: {
          phone: normalizePhone(String(body.phone ?? "")),
          ...(typeof body.phoneCode === "string" && body.phoneCode ? { phoneCode: body.phoneCode } : {}),
        },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    console.error("API error [/api/profile]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
