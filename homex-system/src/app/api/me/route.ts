import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

export async function GET() {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const res = NextResponse.json({
    id: user.id,
    name: user.name,
    role: user.role,
    civilId: user.civilId,
  });
  res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=120");
  return res;
}
