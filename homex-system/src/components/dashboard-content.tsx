"use client";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/sidebar-context";

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n();
  const { collapsed } = useSidebar();

  // On large screens the content is offset by the 256px sidebar; when the
  // sidebar is collapsed it reclaims the full width. On phones the sidebar is
  // an overlay, so no offset. The margin animates for a smooth expand/collapse.
  return (
    <main
      className={cn(
        "flex-1 p-4 sm:p-6 min-w-0 transition-[margin] duration-300 ease-in-out",
        !collapsed && (dir === "rtl" ? "lg:mr-64" : "lg:ml-64")
      )}
    >
      {children}
    </main>
  );
}
