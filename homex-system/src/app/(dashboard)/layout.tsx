import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getRolePermissions } from "@/lib/permissions";
import { boardEditorId, canAccessBoard } from "@/lib/delivery-board";
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
  const u = session.user as { id: string; role: string };
  const canSeeBoard = canAccessBoard(u.role, u.id, await boardEditorId().catch(() => ""));

  return (
    <div className="flex min-h-screen">
      <SessionGuard />
      <Sidebar user={session.user as any} permissions={permissions} canSeeBoard={canSeeBoard} />
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
