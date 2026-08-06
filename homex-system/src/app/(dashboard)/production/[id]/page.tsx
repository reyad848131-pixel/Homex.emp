import { redirect, notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/permissions";
import { ProductionClient } from "./production-client";

export const dynamic = "force-dynamic";

// Full-page production workspace for a single order: every item with its stage
// pipeline, laid out with room to breathe (much easier than the packed board
// card). Managers/field-ops only, mirroring the work board's own guard.
export default async function ProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuth();
  const user = session?.user as { role?: string } | undefined;
  const allowed = user?.role === "admin" || user?.role === "ceo" || user?.role === "manager" || await userCan(user?.role || "", "work_orders");
  if (!allowed) redirect("/");

  const order = await prisma.quotation.findFirst({
    where: { id },
    select: {
      id: true, quoteNumber: true, total: true, deliveryDate: true, workStatus: true,
      customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, description: true, quantity: true, lineTotal: true,
          category: { select: { nameAr: true, nameEn: true } },
          tasks: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true, stage: true, workerId: true, doneAt: true, sortOrder: true,
              worker: { select: { id: true, name: true, color: true } },
            },
          },
        },
      },
    },
  });
  if (!order) notFound();

  const workers = await prisma.worker.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, color: true },
  });

  return (
    <ProductionClient
      order={JSON.parse(JSON.stringify(order))}
      workers={JSON.parse(JSON.stringify(workers))}
    />
  );
}
