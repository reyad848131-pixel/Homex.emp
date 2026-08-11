import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextWorkerColor } from "@/lib/workers";
import { userCan } from "@/lib/permissions";

// Managing the workers list requires the "workers" permission (admin/ceo/manager
// and accountant have it, plus any custom role granted it).
function canManageWorkers(user: { role?: string } | null | undefined) {
  return userCan(String(user?.role || ""), "workers");
}

// GET: list workers. All logged-in users can read (the board needs the list to
// assign tasks); by default only active ones, ?all=true adds inactive.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const all = req.nextUrl.searchParams.get("all") === "true";
    const workers = await prisma.worker.findMany({
      where: all ? {} : { isActive: true },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(workers);
  } catch (e) {
    console.error("API error [/api/workers]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: create a worker (managers only).
export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await canManageWorkers(session.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const name = (body.name || "").trim();
    if (!name) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });

    const used = (await prisma.worker.findMany({ select: { color: true } })).map((w) => w.color);
    const worker = await prisma.worker.create({
      data: {
        name,
        color: body.color || nextWorkerColor(used),
        sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : 0,
      },
    });
    return NextResponse.json(worker, { status: 201 });
  } catch (e) {
    console.error("API error [/api/workers]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
