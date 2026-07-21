import { NextResponse } from "next/server";

const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || Date.now().toString(36);

export async function GET() {
  return NextResponse.json(
    { version: BUILD_ID },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
