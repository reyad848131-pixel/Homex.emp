import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function csvSafe(val: string): string {
  const escaped = val.replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(escaped)) return `"'${escaped}"`;
  return `"${escaped}"`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
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

    const header = ["رقم العرض", "الرقم المرجعي", "العميل", "الهاتف", "المحافظة", "الموظف", "الحالة", "المجموع", "الضريبة", "الإجمالي", "الدفعة المقدمة", "عدد البنود", "التاريخ"];
    const statusLabels: Record<string, string> = { draft: "مسودة", pending: "قيد المراجعة", approved: "معتمد", declined: "مرفوض" };

    const rows = quotations.map((q) => [
      q.quoteNumber,
      q.originalNumber || "",
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

    const csv = "﻿" + [header, ...rows].map((r) => r.map((c) => csvSafe(c)).join(",")).join("\n");

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

    const csv = "﻿" + [header, ...rows].map((r) => r.map((c) => csvSafe(c)).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="customers-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  if (type === "deliveries") {
    // Delivery schedule: dated orders, upcoming first.
    const orders = await prisma.quotation.findMany({
      where: { deliveryDate: { not: null } },
      include: { customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } } },
      orderBy: [{ deliveryDate: "asc" }, { deliveryTime: "asc" }],
      take: 5000,
    });
    const WS: Record<string, string> = {
      needs_preparation: "قيد التحضير", ready_to_execute: "قيد التنفيذ", in_progress: "قيد التنفيذ",
      completed: "اكتمل", ready_for_delivery: "جاهز للتوصيل", delivered: "تم التوصيل",
      ready_for_install: "جاهز للتركيب", installed: "تم التركيب",
    };
    const header = ["رقم الطلب", "العميل", "الهاتف", "المحافظة", "الولاية", "تاريخ التسليم", "الوقت", "السائق", "الحالة"];
    const rows = orders.map((q) => [
      q.quoteNumber,
      q.customer.name,
      `${q.customer.phoneCode}${q.customer.phone}`,
      q.customer.governorate,
      q.customer.wilayat,
      q.deliveryDate ? new Date(q.deliveryDate).toLocaleDateString("en-GB") : "",
      q.deliveryTime || "",
      q.deliveryDriver || "",
      q.workStatus ? (WS[q.workStatus] || q.workStatus) : "",
    ]);
    const csv = "﻿" + [header, ...rows].map((r) => r.map((c) => csvSafe(c)).join(",")).join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="deliveries-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e) {
    console.error("API error [/api/export]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
