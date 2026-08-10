import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";

function canManageWorkers(user: { role?: string } | null | undefined) {
  return userCan(String(user?.role || ""), "workers");
}

// PATCH: update a worker's name / colour / active state (managers only).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await canManageWorkers(session.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.color === "string") data.color = body.color;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (Number.isFinite(body.sortOrder)) data.sortOrder = body.sortOrder;

    const worker = await prisma.worker.update({ where: { id }, data });
    return NextResponse.json(worker);
  } catch (e) {
    console.error("API error [/api/workers/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE: remove a worker. If they have any recorded tasks, deactivate instead
// (so their productivity history and the tasks' assignment stay intact).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await canManageWorkers(session.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const taskCount = await prisma.itemTask.count({ where: { workerId: id } });
    if (taskCount > 0) {
      await prisma.worker.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ deactivated: true });
    }
    await prisma.worker.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error("API error [/api/workers/[id]]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
