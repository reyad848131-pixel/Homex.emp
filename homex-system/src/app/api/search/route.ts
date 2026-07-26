import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Global search across quotations and customers. Sales see only their own
// quotes; managers/admins see everything.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;
    const isAdmin = user.role === "admin" || user.role === "manager";

    const q = (new URL(req.url).searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ quotations: [], customers: [] });

    const like = { contains: q, mode: "insensitive" as const };
    const quoteWhere: any = isAdmin ? {} : { employeeId: user.id };
    quoteWhere.OR = [
      { quoteNumber: like },
      { customer: { name: like } },
      { customer: { phone: { contains: q } } },
    ];
    const custWhere: any = isAdmin ? {} : { createdBy: user.id };
    custWhere.OR = [{ name: like }, { phone: { contains: q } }];

    const [quotations, customers] = await Promise.all([
      prisma.quotation.findMany({
        where: quoteWhere,
        select: { id: true, quoteNumber: true, status: true, total: true, customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.customer.findMany({
        where: custWhere,
        select: { id: true, name: true, phone: true, governorate: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return NextResponse.json({ quotations, customers });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
