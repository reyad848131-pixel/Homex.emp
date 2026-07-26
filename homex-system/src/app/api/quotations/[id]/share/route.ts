import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Generate (once) and return the unguessable public token for a quotation, so
// the salesperson can share a customer-facing accept/reject link.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const { id } = await params;

    const quotation = await prisma.quotation.findUnique({ where: { id }, select: { id: true, employeeId: true, publicToken: true } });
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "sales" && quotation.employeeId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let token = quotation.publicToken;
    if (!token) {
      token = randomBytes(24).toString("base64url");
      await prisma.quotation.update({ where: { id }, data: { publicToken: token } });
      await logAction(user.id, "share_link", "quotation", id, "");
    }

    return NextResponse.json({ token });
  } catch (e) {
    console.error("API error [/api/quotations/[id]/share]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
