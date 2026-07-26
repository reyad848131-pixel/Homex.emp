import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getRolePermissions } from "@/lib/permissions";
import { Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { DashboardContent } from "@/components/dashboard-content";
import { GlobalSearch } from "@/components/global-search";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuth();
  if (!session) redirect("/login");

  const permissions = await getRolePermissions((session.user as any).role).catch(() => []);

  return (
    <div className="flex min-h-screen">
      <Sidebar user={session.user as any} permissions={permissions} />
      <DashboardContent>
        <div className="flex items-center gap-3 mb-4 no-print">
          <GlobalSearch />
          <div className="flex-1" />
          <NotificationBell />
        </div>
        {children}
      </DashboardContent>
    </div>
  );
}
