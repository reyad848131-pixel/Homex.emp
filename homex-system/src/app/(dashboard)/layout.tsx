import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/notification-bell";

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
      <main className="flex-1 mr-64 p-6 max-lg:mr-0">
        <div className="flex justify-end mb-4 no-print">
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}
