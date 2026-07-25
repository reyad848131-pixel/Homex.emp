import { getWorkOrders } from "@/lib/work-orders-list";
import { WorkOrdersClient } from "./work-orders-client";

// Server-render the default (unfiltered) board so it paints with real data;
// the client component takes over for filters, search and inline edits.
export default async function WorkOrdersPage() {
  const initial = await getWorkOrders({});
  return <WorkOrdersClient initialData={JSON.parse(JSON.stringify(initial))} />;
}
