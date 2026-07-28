import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { userCan } from "@/lib/permissions";

// Bulk soft-delete quotations (move to Trash). Reversible from the Trash page,
// so it's an admin/manager convenience for clearing out test data. Gated to the
// same capability as Trash. updateMany bypasses the soft-delete read filter, so
// we add the explicit deletedAt:null guard ourselves.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const privileged = user.role === "admin" || user.role === "ceo" || user.role === "manager";
    if (!(privileged || (await userCan(user.role, "trash")))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const ids = (Array.isArray(body?.ids) ? body.ids : []).filter((x: any) => typeof x === "string").slice(0, 1000);
    if (ids.length === 0) return NextResponse.json({ error: "No ids" }, { status: 400 });

    const res = await prisma.quotation.updateMany({
      where: { id: { in: ids }, deletedAt: null } as any,
      data: { deletedAt: new Date(), deletedBy: user.id },
    });

    await logAction(user.id, "bulk_delete", "quotation", undefined, JSON.stringify({ requested: ids.length, deleted: res.count }));
    return NextResponse.json({ deleted: res.count });
  } catch (e) {
    console.error("API error [/api/quotations/bulk-delete]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
