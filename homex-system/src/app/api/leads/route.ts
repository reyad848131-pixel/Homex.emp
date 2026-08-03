import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseIntParam } from "@/lib/utils";

// Staff-facing list of website enquiries (leads). Managers/sales review these
// and convert genuine ones into customers.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseIntParam(searchParams.get("page"), 1);
    const limit = parseIntParam(searchParams.get("limit"), 30, 1, 100);
    const status = (searchParams.get("status") || "").trim();

    const where: { status?: string } = {};
    if (status && status !== "all") where.status = status;

    const [leads, total, grouped] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
      prisma.lead.groupBy({ by: ["status"], _count: true }),
    ]);

    const stats = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
    return NextResponse.json({ leads, total, stats, newCount: stats.new || 0, page, limit });
  } catch {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
