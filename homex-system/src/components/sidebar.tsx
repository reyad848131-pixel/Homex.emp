"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import {
  LayoutDashboard,
  FileText,
  FilePlus,
  Users,
  UsersRound,
  Settings,
  ScrollText,
  BarChart3,
  Layers,
  LogOut,
  Menu,
  X,
  Truck,
} from "lucide-react";
import { useState, useEffect } from "react";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { LanguageToggle } from "@/components/language-toggle";

const ROLE_KEYS: Record<string, TranslationKey> = {
  admin: "roleAdmin",
  manager: "roleManager",
  sales: "roleSales",
};

interface SidebarProps {
  user: { name: string; role: string; civilId: string };
}

const navItems: Array<{ href: string; labelKey: TranslationKey; icon: any }> = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/quotations", labelKey: "quotations", icon: FileText },
  { href: "/quotations/new", labelKey: "newQuotation", icon: FilePlus },
  { href: "/customers", labelKey: "customers", icon: Users },
];

const managerItems: Array<{ href: string; labelKey: TranslationKey; icon: any }> = [
  { href: "/work-orders", labelKey: "workOrders", icon: Truck },
  { href: "/reports", labelKey: "reports", icon: BarChart3 },
];

const adminItems: Array<{ href: string; labelKey: TranslationKey; icon: any }> = [
  { href: "/employees", labelKey: "employees", icon: UsersRound },
  { href: "/categories", labelKey: "categories", icon: Layers },
  { href: "/audit-logs", labelKey: "auditLogs", icon: ScrollText },
  { href: "/settings", labelKey: "settings", icon: Settings },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logo, setLogo] = useState("");
  const { t } = useI18n();

  useEffect(() => {
    fetch("/api/logo").then((r) => r.json()).then((d) => setLogo(d.logo || "")).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const items = user.role === "admin"
    ? [...navItems, ...managerItems, ...adminItems]
    : user.role === "manager"
      ? [...navItems, ...managerItems]
      : navItems;

  const content = (
    <>
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        {logo ? (
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">homex</h1>
              <p className="text-[9px] tracking-[0.12em] uppercase text-gray-400 font-medium font-mono-en">
                Quotation System
              </p>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">homex</h1>
            <p className="text-[10px] tracking-[0.12em] uppercase text-gray-400 font-medium mt-0.5 font-mono-en">
              Quotation System
            </p>
          </>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded text-sm font-semibold transition-colors",
                isActive
                  ? "bg-gray-900 text-white dark:bg-gray-600"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <item.icon className="w-[18px] h-[18px]" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gray-900 dark:bg-gray-600 text-white flex items-center justify-center text-sm font-bold">
            {user.name.charAt(0)}
          </div>
          <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate hover:underline">{user.name}</p>
            <p className="text-[11px] text-gray-400 font-mono-en">
              {ROLE_KEYS[user.role] ? t(ROLE_KEYS[user.role]) : user.role}
            </p>
          </Link>
        </div>
        <LanguageToggle />
        <DarkModeToggle />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors font-semibold"
        >
          <LogOut className="w-4 h-4" />
          {t("logout")}
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        className="fixed top-4 right-4 z-50 lg:hidden bg-gray-900 text-white p-2 rounded-lg shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 right-0 h-full w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col z-40 transition-transform",
          "max-lg:translate-x-full",
          mobileOpen && "max-lg:translate-x-0"
        )}
      >
        {content}
      </aside>
    </>
  );
}
