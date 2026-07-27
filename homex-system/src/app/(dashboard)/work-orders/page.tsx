import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getWorkOrders } from "@/lib/work-orders-list";
import { userCan } from "@/lib/permissions";
import { WorkOrdersClient } from "./work-orders-client";

// Server-render the default (unfiltered) board so it paints with real data;
// the client component takes over for filters, search and inline edits.
export default async function WorkOrdersPage() {
  const session = await getAuth();
  const user = session?.user as any;
  // The work board (driving job stages) is for managers/admins only. Field
  // roles like the driver are limited to the delivery/installation schedules.
  const allowed = user?.role === "admin" || user?.role === "ceo" || user?.role === "manager" || await userCan(user?.role, "work_orders");
  if (!allowed) redirect("/");

  const initial = await getWorkOrders({});
  return <WorkOrdersClient initialData={JSON.parse(JSON.stringify(initial))} />;
}
