import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { foremanAccessIds, canAccessForeman } from "@/lib/foreman-access";

const STATUSES = ["not_ordered", "ordered", "arrived", "installed"];

// Any signed-in user may VIEW components; only the foreman/owner may change them.
async function authUser() {
  const session = await getAuth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user: session.user as { id: string; role: string; civilId: string } };
}
async function canEdit(user: { civilId: string; id: string }) {
  return canAccessForeman(user.civilId, user.id, await foremanAccessIds().catch(() => []));
}

// GET ?itemId=  → the components attached to one item (view-only, any user).
export async function GET(req: NextRequest) {
  const a = await authUser();
  if (a.error) return a.error;
  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId مطلوب" }, { status: 400 });
  const components = await prisma.itemComponent.findMany({
    where: { itemId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(components);
}

// POST { itemId, items: [{ catalogId?, name }] }  → attach components to an item.
export async function POST(req: NextRequest) {
  const a = await authUser();
  if (a.error) return a.error;
  if (!(await canEdit(a.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const itemId = String(body.itemId || "");
  if (!itemId) return NextResponse.json({ error: "itemId مطلوب" }, { status: 400 });
  const rows: Array<{ catalogId?: string; name?: string }> = Array.isArray(body.items)
    ? body.items
    : [{ catalogId: body.catalogId, name: body.name }];
  const data = rows
    .map((r) => ({ name: String(r.name || "").trim(), catalogId: r.catalogId ? String(r.catalogId) : null }))
    .filter((r) => r.name)
    .map((r) => ({ itemId, name: r.name, catalogId: r.catalogId, updatedBy: a.user.id }));
  if (data.length === 0) return NextResponse.json({ error: "لا عناصر" }, { status: 400 });
  await prisma.itemComponent.createMany({ data });
  const components = await prisma.itemComponent.findMany({ where: { itemId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(components, { status: 201 });
}

// PATCH { id, status?, note? }  → advance a component's status (foreman/owner).
export async function PATCH(req: NextRequest) {
  const a = await authUser();
  if (a.error) return a.error;
  if (!(await canEdit(a.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  const data: Record<string, unknown> = { updatedBy: a.user.id };
  if (typeof body.note === "string") data.note = body.note.trim() || null;
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!STATUSES.includes(status)) return NextResponse.json({ error: "حالة غير صحيحة" }, { status: 400 });
    data.status = status;
    const now = new Date();
    // Keep timestamps consistent with the status along the 4-stage flow
    // (not_ordered → ordered → arrived → installed); each stage implies all
    // earlier stages happened.
    if (status === "not_ordered") { data.orderedAt = null; data.arrivedAt = null; data.installedAt = null; }
    else if (status === "ordered") { data.orderedAt = now; data.arrivedAt = null; data.installedAt = null; }
    else if (status === "arrived") { data.arrivedAt = now; data.installedAt = null; }
    else if (status === "installed") { data.installedAt = now; }
  }
  const updated = await prisma.itemComponent.update({ where: { id }, data });
  // Backfill earlier timestamps when jumping ahead.
  const patch: Record<string, Date> = {};
  if (["arrived", "installed"].includes(updated.status) && !updated.orderedAt) patch.orderedAt = updated.arrivedAt ?? updated.installedAt ?? new Date();
  if (updated.status === "installed" && !updated.arrivedAt) patch.arrivedAt = updated.installedAt ?? new Date();
  if (Object.keys(patch).length) await prisma.itemComponent.update({ where: { id }, data: patch });
  return NextResponse.json(updated);
}

// DELETE ?id=  → remove a component (foreman/owner).
export async function DELETE(req: NextRequest) {
  const a = await authUser();
  if (a.error) return a.error;
  if (!(await canEdit(a.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  await prisma.itemComponent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
