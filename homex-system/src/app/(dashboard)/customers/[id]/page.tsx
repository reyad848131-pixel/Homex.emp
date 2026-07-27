import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getRolePermissions } from "@/lib/permissions";
import { CustomerDetailClient } from "./customer-detail-client";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth();
  const user = session?.user as any;
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id },
    include: {
      creator: { select: { name: true } },
      quotations: {
        include: {
          employee: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) return notFound();

  const privileged = (user?.role === "admin" || user?.role === "ceo") || user?.role === "manager";
  const perms = (await getRolePermissions(user?.role).catch(() => [])) as string[];
  const viewAll = privileged || perms.includes("customers_view");
  const canView = viewAll || perms.includes("customers");
  if (!canView) return notFound();
  // Sales see only their own customers; viewers/managers see all.
  if (!viewAll && customer.createdBy !== user?.id) return notFound();

  // Money is redacted for roles without financial access (e.g. photographer).
  const canSeeFinancials = privileged || perms.includes("financials");

  const approvedQuotes = customer.quotations.filter((q) => q.status === "approved");
  const totalRevenue = approvedQuotes.reduce((sum, q) => sum + q.total, 0);

  const data = {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    phoneCode: customer.phoneCode,
    governorate: customer.governorate,
    wilayat: customer.wilayat,
    address: customer.address,
    creatorName: customer.creator.name,
    createdAt: customer.createdAt.toISOString(),
    totalQuotes: customer.quotations.length,
    approvedCount: approvedQuotes.length,
    canManage: privileged || perms.includes("customers"),
    canSeeFinancials,
    totalRevenue: canSeeFinancials ? totalRevenue : null,
    quotations: customer.quotations.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      employeeName: q.employee.name,
      status: q.status,
      itemCount: q._count.items,
      total: canSeeFinancials ? q.total : null,
      createdAt: q.createdAt.toISOString(),
    })),
  };

  return <CustomerDetailClient data={data} />;
}
