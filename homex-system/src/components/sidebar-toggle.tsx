"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "@/components/sidebar-context";

// The ☰ button that lives in the page top bar on every screen size. Collapses
// or expands the sidebar on desktop, opens or closes the overlay on phones.
export function SidebarToggle() {
  const { toggle } = useSidebar();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle menu"
      className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors no-print"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
