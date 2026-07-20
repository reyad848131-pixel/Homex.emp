import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const isSecure =
    process.env.VERCEL === "1" ||
    req.headers.get("x-forwarded-proto") === "https" ||
    process.env.NEXTAUTH_URL?.startsWith("https");

  const response = NextResponse.json({ ok: true });

  const cookieNames = isSecure
    ? ["__Secure-next-auth.session-token", "next-auth.session-token"]
    : ["next-auth.session-token"];

  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: !!isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
