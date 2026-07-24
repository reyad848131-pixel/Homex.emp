import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CustomerDetailClient } from "./customer-detail-client";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth();
  const user = session?.user as any;
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
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

  const isAdmin = user?.role === "admin" || user?.role === "manager";
  if (!isAdmin && customer.createdBy !== user?.id) return notFound();

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
    totalRevenue,
    quotations: customer.quotations.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      employeeName: q.employee.name,
      status: q.status,
      itemCount: q._count.items,
      total: q.total,
      createdAt: q.createdAt.toISOString(),
    })),
  };

  return <CustomerDetailClient data={data} />;
}
