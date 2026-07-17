import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role === "sales") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "quotations";

  if (type === "quotations") {
    const quotations = await prisma.quotation.findMany({
      include: {
        customer: true,
        employee: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const header = ["رقم العرض", "العميل", "الهاتف", "المحافظة", "الموظف", "الحالة", "المجموع", "الضريبة", "الإجمالي", "الدفعة المقدمة", "عدد البنود", "التاريخ"];
    const statusLabels: Record<string, string> = { draft: "مسودة", pending: "قيد المراجعة", approved: "معتمد", declined: "مرفوض" };

    const rows = quotations.map((q) => [
      q.quoteNumber,
      q.customer.name,
      `${q.customer.phoneCode}${q.customer.phone}`,
      q.customer.governorate,
      q.employee.name,
      statusLabels[q.status] || q.status,
      q.subtotal.toFixed(3),
      q.vatAmount.toFixed(3),
      q.total.toFixed(3),
      q.advanceAmount.toFixed(3),
      q._count.items.toString(),
      new Date(q.createdAt).toLocaleDateString("ar-OM"),
    ]);

    const csv = "﻿" + [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="quotations-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  if (type === "customers") {
    const customers = await prisma.customer.findMany({
      include: { _count: { select: { quotations: true } } },
      orderBy: { createdAt: "desc" },
    });

    const header = ["الاسم", "الهاتف", "المحافظة", "الولاية", "العنوان", "عدد العروض", "التاريخ"];
    const rows = customers.map((c) => [
      c.name,
      `${c.phoneCode}${c.phone}`,
      c.governorate,
      c.wilayat,
      c.address || "",
      c._count.quotations.toString(),
      new Date(c.createdAt).toLocaleDateString("ar-OM"),
    ]);

    const csv = "﻿" + [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="customers-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
