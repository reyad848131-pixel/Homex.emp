import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || "unknown";
  const secret = process.env.NEXTAUTH_SECRET ? "SET" : "NOT SET";
  const dbUrl = process.env.DATABASE_URL ? "SET" : "NOT SET";
  const nodeEnv = process.env.NODE_ENV;

  // Test the CSRF endpoint
  let csrfResult = "not tested";
  try {
    const csrfUrl = `${baseUrl}/api/auth/csrf`;
    const res = await fetch(csrfUrl);
    csrfResult = `status=${res.status}, body=${await res.text()}`;
  } catch (err: any) {
    csrfResult = `error: ${err.message}`;
  }

  return NextResponse.json({
    NEXTAUTH_URL: baseUrl,
    NEXTAUTH_SECRET: secret,
    DATABASE_URL: dbUrl,
    NODE_ENV: nodeEnv,
    csrfTest: csrfResult,
    headers: {
      host: req.headers.get("host"),
      xForwardedProto: req.headers.get("x-forwarded-proto"),
    },
  });
}
