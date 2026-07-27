import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { userCan } from "@/lib/permissions";

async function guard() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = session.user as any;
  if (!(await userCan(user.role, "trash"))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

// GET: list trashed quotations + customers. Explicit deletedAt filter bypasses
// the soft-delete read filter so deleted rows are returned.
export async function GET() {
  try {
    const g = await guard();
    if (g.error) return g.error;

    const [quotations, customers] = await Promise.all([
      prisma.quotation.findMany({
        where: { deletedAt: { not: null } },
        select: {
          id: true, quoteNumber: true, total: true, status: true, deletedAt: true, deletedBy: true,
          customer: { select: { name: true } },
        },
        orderBy: { deletedAt: "desc" },
        take: 200,
      }),
      prisma.customer.findMany({
        where: { deletedAt: { not: null } },
        select: { id: true, name: true, phone: true, governorate: true, wilayat: true, deletedAt: true, deletedBy: true },
        orderBy: { deletedAt: "desc" },
        take: 200,
      }),
    ]);

    // Resolve "deleted by" employee names.
    const ids = [...new Set([...quotations, ...customers].map((r) => r.deletedBy).filter(Boolean) as string[])];
    const emps = ids.length ? await prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const nameOf = new Map(emps.map((e) => [e.id, e.name]));
    const withName = <T extends { deletedBy: string | null }>(r: T) => ({ ...r, deletedByName: r.deletedBy ? nameOf.get(r.deletedBy) || "" : "" });

    return NextResponse.json({
      quotations: quotations.map(withName),
      customers: customers.map(withName),
    });
  } catch (e) {
    console.error("API error [/api/trash]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: restore an item — { type: "quotation" | "customer", id }.
export async function POST(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const body = await req.json().catch(() => ({}));
    const { type, id } = body;
    if (!id || (type !== "quotation" && type !== "customer")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (type === "quotation") {
      await prisma.quotation.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
    } else {
      await prisma.customer.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
    }
    await logAction(g.user.id, "restore", type, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error [/api/trash POST]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE: permanently remove an item — ?type=quotation|customer&id=...
export async function DELETE(req: NextRequest) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const id = url.searchParams.get("id") || "";
    if (!id || (type !== "quotation" && type !== "customer")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (type === "quotation") {
      // Items/payments/invoice cascade; service requests don't — clear them first.
      await prisma.$transaction([
        prisma.serviceRequest.deleteMany({ where: { quotationId: id } }),
        prisma.quotation.delete({ where: { id } }),
      ]);
    } else {
      await prisma.customer.delete({ where: { id } });
    }
    await logAction(g.user.id, "purge", type, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error [/api/trash DELETE]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
