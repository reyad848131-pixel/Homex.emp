import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";

// Problems/flags raised on items. Viewing is open to signed-in users; raising/
// resolving is the foreman/owner's job (workers don't use the app directly).
async function authUser() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user: session.user as { id: string; role: string; civilId: string } };
}
async function canEdit(u: { civilId: string; id: string }) {
  return canAccessForeman(u.civilId, u.id, await foremanAccessIds().catch(() => []));
}

// GET ?itemId=  → issues of one item.  GET ?open=1  → all OPEN issues (foreman).
export async function GET(req: NextRequest) {
  const a = await authUser();
  if (a.error) return a.error;
  const itemId = req.nextUrl.searchParams.get("itemId");
  const openOnly = req.nextUrl.searchParams.get("open") === "1";
  if (itemId) {
    const issues = await prisma.itemIssue.findMany({ where: { itemId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(issues);
  }
  if (openOnly) {
    const issues = await prisma.itemIssue.findMany({
      where: { status: "open", item: { quotation: { deletedAt: null } } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        item: { select: { id: true, description: true, quotation: { select: { id: true, quoteNumber: true, customer: { select: { name: true } } } } } },
      },
    });
    return NextResponse.json(issues);
  }
  return NextResponse.json({ error: "itemId أو open مطلوب" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const a = await authUser();
  if (a.error) return a.error;
  if (!(await canEdit(a.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const itemId = String(body.itemId || "");
  const note = String(body.note || "").trim();
  if (!itemId || !note) return NextResponse.json({ error: "itemId والملاحظة مطلوبان" }, { status: 400 });
  const issue = await prisma.itemIssue.create({
    data: { itemId, note, photoUrl: typeof body.photoUrl === "string" && body.photoUrl ? body.photoUrl : null, createdBy: a.user.id },
  });
  return NextResponse.json(issue, { status: 201 });
}

// PATCH { id, status: "resolved" | "open" }
export async function PATCH(req: NextRequest) {
  const a = await authUser();
  if (a.error) return a.error;
  if (!(await canEdit(a.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  const resolved = body.status === "resolved";
  const issue = await prisma.itemIssue.update({
    where: { id },
    data: { status: resolved ? "resolved" : "open", resolvedAt: resolved ? new Date() : null, resolvedBy: resolved ? a.user.id : null },
  });
  return NextResponse.json(issue);
}

export async function DELETE(req: NextRequest) {
  const a = await authUser();
  if (a.error) return a.error;
  if (!(await canEdit(a.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  await prisma.itemIssue.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
