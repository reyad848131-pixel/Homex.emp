import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getRolePermissions } from "@/lib/permissions";
import { settingsAccessIds, canAccessSettings } from "@/lib/settings-access";
import { Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { DashboardContent } from "@/components/dashboard-content";
import { GlobalSearch } from "@/components/global-search";
import { SessionGuard } from "@/components/session-guard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuth();
  if (!session) redirect("/login");

  const permissions = await getRolePermissions((session.user as any).role).catch(() => []);
  const su = session.user as any;
  const settingsEditors = await settingsAccessIds().catch(() => [] as string[]);
  const settingsAccess = canAccessSettings(su.civilId, su.id, settingsEditors);

  return (
    <div className="flex min-h-screen">
      <SessionGuard />
      <Sidebar user={session.user as any} permissions={permissions} canAccessSettings={settingsAccess} />
      <DashboardContent>
        {/* ps-12 on mobile reserves room for the fixed hamburger button (which
            sits at the inline-start top corner) so it doesn't cover the search. */}
        <div className="flex items-center gap-3 mb-4 no-print max-lg:ps-12">
          <GlobalSearch />
          <div className="flex-1" />
          <NotificationBell />
        </div>
        {children}
      </DashboardContent>
    </div>
  );
}
