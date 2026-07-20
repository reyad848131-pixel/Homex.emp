import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage() {
  const session = await getAuth();
  const user = session?.user as any;
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const customers = await prisma.customer.findMany({
    where: isAdmin ? {} : { createdBy: user?.id },
    include: {
      _count: { select: { quotations: true } },
      creator: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return <CustomersClient customers={customers.map((c) => ({
    id: c.id, name: c.name, phone: c.phone, phoneCode: c.phoneCode,
    governorate: c.governorate, wilayat: c.wilayat,
    creatorName: c.creator.name, quotationCount: c._count.quotations,
  }))} />;
}
