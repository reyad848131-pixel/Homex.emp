import { notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSpecsCatalog, seedMissingStages } from "@/lib/foreman";
import { specRowsFromDetails } from "@/lib/specs-catalog";
import { canAccessForeman, foremanAccessIds } from "@/lib/foreman-access";
import { applyQuoteLocation } from "@/lib/quote-location";
import { ItemPageClient } from "./item-client";

// The per-item page opened by scanning the item's barcode (in-app) or from the
// production console. Shows the item's FIXED specs (read-only) plus its LIVE
// components (editable by the foreman/owner). Any signed-in user may view.
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuth();
  const user = session?.user as { id: string; civilId: string } | undefined;
  if (!user) notFound();

  const item = await prisma.quoteItem.findFirst({
    where: { id },
    select: {
      id: true, description: true, quantity: true, details: true, categoryId: true,
      qcStatus: true, qcNote: true, qcAt: true,
      tasks: { orderBy: { sortOrder: "asc" }, select: { id: true, stage: true, workerId: true, doneAt: true, doneBy: true, createdAt: true, worker: { select: { name: true, color: true } } } },
      category: { select: { nameAr: true, nameEn: true } },
      quotation: {
        select: {
          id: true, quoteNumber: true, deliveryDate: true, workStatus: true,
          woodStatus: true, fabricStatus: true,
          governorate: true, wilayat: true, address: true,
          customer: { select: { name: true, phone: true, phoneCode: true, governorate: true, wilayat: true } },
        },
      },
      photos: { select: { id: true, url: true, kind: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!item) notFound();

  // Auto-seed this item's manufacturing stages from its category template if it
  // has none yet, then reload them — so stages always show without a manual step.
  if (item.tasks.length === 0) {
    await seedMissingStages(item.id);
    item.tasks = await prisma.itemTask.findMany({
      where: { quoteItemId: item.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, stage: true, workerId: true, doneAt: true, doneBy: true, createdAt: true, worker: { select: { name: true, color: true } } },
    });
  }

  applyQuoteLocation(item.quotation as Parameters<typeof applyQuoteLocation>[0]);

  const catalog = await getSpecsCatalog();
  const specs = specRowsFromDetails(item.details, catalog);
  const canEdit = canAccessForeman(user.civilId, user.id, await foremanAccessIds().catch(() => []));

  // Resolve the "done by" user ids on stages to names for the timeline.
  const doneByIds = Array.from(new Set(item.tasks.map((t) => t.doneBy).filter(Boolean) as string[]));
  const [emps, workers] = await Promise.all([
    doneByIds.length ? prisma.employee.findMany({ where: { id: { in: doneByIds } }, select: { id: true, name: true } }) : Promise.resolve([] as { id: string; name: string }[]),
    prisma.worker.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, color: true } }),
  ]);
  const nameById = new Map(emps.map((e) => [e.id, e.name]));

  const data = {
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    categoryId: item.categoryId,
    categoryName: { ar: item.category.nameAr, en: item.category.nameEn },
    quoteNumber: item.quotation.quoteNumber,
    quotationId: item.quotation.id,
    deliveryDate: item.quotation.deliveryDate ? item.quotation.deliveryDate.toISOString() : null,
    workStatus: item.quotation.workStatus,
    woodStatus: item.quotation.woodStatus || "not_ordered",
    fabricStatus: item.quotation.fabricStatus || "not_ordered",
    customerName: item.quotation.customer?.name || "",
    phone: item.quotation.customer ? `${item.quotation.customer.phoneCode}${item.quotation.customer.phone}` : "",
    governorate: item.quotation.customer?.governorate || "",
    wilayat: item.quotation.customer?.wilayat || "",
    specs,
    photos: item.photos,
    canEdit,
    qc: { status: item.qcStatus, note: item.qcNote, at: item.qcAt ? item.qcAt.toISOString() : null },
    workers,
    stages: item.tasks.map((tsk) => ({
      id: tsk.id,
      stage: tsk.stage,
      workerId: tsk.workerId,
      workerName: tsk.worker?.name || null,
      workerColor: tsk.worker?.color || null,
      doneAt: tsk.doneAt ? tsk.doneAt.toISOString() : null,
      doneByName: tsk.doneBy ? (nameById.get(tsk.doneBy) || null) : null,
    })),
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <ItemPageClient data={data} />
    </div>
  );
}
