import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { verifyCredentials } from "@/lib/login-guard";
import { captureError } from "@/lib/error-tracking";

// TEMPORARY diagnostic: on a failed login, record WHAT the device actually sent
// (civil ID + its character codes, password length/charset flags — never the
// password itself) into the error log so an admin can see it at /error-logs.
// This isolates device-specific input problems (e.g. an iPad sending different
// characters) without exposing secrets. Remove once the login issue is solved.
function codesOf(s: string): string {
  return Array.from(s).map((c) => c.codePointAt(0)).join(",");
}
async function logLoginDebug(req: NextRequest, civilId: string, password: string) {
  try {
    const pw = String(password ?? "");
    const cid = String(civilId ?? "");
    const asciiOnly = /^[\x20-\x7E]*$/.test(pw);
    const arabicDigits = /[٠-٩۰-۹]/.test(pw + cid);
    await captureError({
      message: `🔎 LOGIN DEBUG (مؤقت) — محاولة فاشلة · civilId="${cid}"`,
      path: `civilId codes=[${codesOf(cid)}]`,
      method: `pwLen=${pw.length} pwAscii=${asciiOnly} arabicDigits=${arabicDigits} pwLeadingTrailingSpace=${/^\s|\s$/.test(pw)}`,
      routeType: "login-debug",
      stack: `UA=${req.headers.get("user-agent") || ""}`,
    });
  } catch { /* never let diagnostics break login */ }
}

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
      if (result.code === "invalid") await logLoginDebug(req, civilId, password);
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
