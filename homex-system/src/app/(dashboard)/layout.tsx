import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { DashboardContent } from "@/components/dashboard-content";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar user={session.user as any} />
      <DashboardContent>
        <div className="flex justify-end mb-4 no-print">
          <NotificationBell />
        </div>
        {children}
      </DashboardContent>
    </div>
  );
}
