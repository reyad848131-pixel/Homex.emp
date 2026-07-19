import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { encode } from "next-auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const { civilId, password } = await req.json();

    if (!civilId || !password) {
      return NextResponse.json({ error: "أدخل الرقم المدني وكلمة المرور" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { civilId },
    });

    if (!employee || !employee.isActive) {
      return NextResponse.json({ error: "رقم مدني أو كلمة مرور غير صحيحة" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) {
      return NextResponse.json({ error: "رقم مدني أو كلمة مرور غير صحيحة" }, { status: 401 });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { lastLogin: new Date() },
    }).catch(() => {});

    const token = await encode({
      token: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        civilId: employee.civilId,
        sub: employee.id,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 24 * 60 * 60,
    });

    const isSecure = process.env.NEXTAUTH_URL?.startsWith("https");
    const cookieName = isSecure
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: !!isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "خطأ في السيرفر" }, { status: 500 });
  }
}
