"use client";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n();

  return (
    <main className={cn("flex-1 p-6 max-lg:ms-0", dir === "rtl" ? "mr-64" : "ml-64")}>
      {children}
    </main>
  );
}
