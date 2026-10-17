"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Shared state for the collapsible sidebar. `collapsed` is the desktop
// preference (remembered across visits); `mobileOpen` drives the phone overlay.
// One toggle serves both: on a large screen it collapses/expands the sidebar
// (content reflows to fill the freed space); on a phone it opens/closes the
// overlay.
interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  toggle: () => void;
}

const Ctx = createContext<SidebarState | null>(null);

export function useSidebar(): SidebarState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSidebar must be used within SidebarProvider");
  return c;
}

const isLarge = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore the saved desktop preference after mount (keeps SSR markup stable).
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("sidebar_collapsed") === "1"); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    if (isLarge()) {
      setCollapsed((v) => {
        const next = !v;
        try { localStorage.setItem("sidebar_collapsed", next ? "1" : "0"); } catch { /* ignore */ }
        return next;
      });
    } else {
      setMobileOpen((v) => !v);
    }
  }, []);

  return <Ctx.Provider value={{ collapsed, mobileOpen, setMobileOpen, toggle }}>{children}</Ctx.Provider>;
}
