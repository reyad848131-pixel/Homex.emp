import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

export async function GET() {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  return NextResponse.json({
    id: user.id,
    name: user.name,
    role: user.role,
    civilId: user.civilId,
  });
}
