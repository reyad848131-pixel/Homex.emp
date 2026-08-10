import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRolePermissions } from "@/lib/permissions";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage() {
  const session = await getAuth();
  const user = session?.user as any;
  const privileged = user?.role === "admin" || user?.role === "ceo" || user?.role === "manager";
  const perms = (await getRolePermissions(user?.role).catch(() => [])) as string[];
  // Must have customers (manage) or customers_view (read-only) to see this page.
  if (!(privileged || perms.includes("customers") || perms.includes("customers_view"))) redirect("/");
  // Read-only viewers (photographer) and managers see all; sales see their own.
  const viewAll = privileged || perms.includes("customers_view");

  const customers = await prisma.customer.findMany({
    where: viewAll ? {} : { createdBy: user?.id },
    include: {
      _count: { select: { quotations: true } },
      creator: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return <CustomersClient customers={customers.map((c) => ({
    id: c.id, name: c.name, phone: c.phone, phoneCode: c.phoneCode,
    governorate: c.governorate, wilayat: c.wilayat, source: c.source,
    creatorName: c.creator.name, quotationCount: c._count.quotations,
  }))} />;
}
