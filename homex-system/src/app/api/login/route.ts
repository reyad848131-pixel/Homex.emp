import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { verifyCredentials } from "@/lib/login-guard";

export async function POST(req: NextRequest) {
  try {
    const { civilId, password } = await req.json();

    if (!civilId || !password) {
      return NextResponse.json(
        { error: "أدخل الرقم المدني وكلمة المرور", code: "missing" },
        { status: 400 }
      );
    }

    const result = await verifyCredentials(civilId, password);

    if (!result.ok) {
      if (result.code === "locked") {
        return NextResponse.json(
          {
            error: "تم قفل الحساب مؤقتاً بسبب محاولات دخول خاطئة كثيرة",
            code: "locked",
            retryAfter: result.retryAfter,
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          error: "رقم مدني أو كلمة مرور غير صحيحة",
          code: "invalid",
          ...(result.remaining !== undefined ? { remaining: result.remaining } : {}),
        },
        { status: 401 }
      );
    }

    const employee = result.employee;

    const isSecure = process.env.VERCEL === "1" ||
      req.headers.get("x-forwarded-proto") === "https" ||
      process.env.NEXTAUTH_URL?.startsWith("https");
    const cookieName = isSecure
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    const token = await encode({
      token: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        civilId: employee.civilId,
        sub: employee.id,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      salt: cookieName,
      maxAge: 24 * 60 * 60,
    });

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
    return NextResponse.json({ error: "خطأ في السيرفر", code: "server" }, { status: 500 });
  }
}
