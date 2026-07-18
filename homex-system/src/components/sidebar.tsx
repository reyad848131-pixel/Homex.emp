"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  manager: "مدير",
  sales: "مبيعات",
};

interface SidebarProps {
  user: { name: string; role: string; civilId: string };
}

const navItems = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/quotations", label: "عروض الأسعار", icon: FileText },
  { href: "/quotations/new", label: "عرض سعر جديد", icon: FilePlus },
  { href: "/customers", label: "العملاء", icon: Users },
];

const managerItems = [
  { href: "/reports", label: "التقارير", icon: BarChart3 },
];

const adminItems = [
  { href: "/employees", label: "الموظفين", icon: UsersRound },
  { href: "/categories", label: "الفئات", icon: Layers },
  { href: "/audit-logs", label: "سجل النشاطات", icon: ScrollText },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = user.role === "admin"
    ? [...navItems, ...managerItems, ...adminItems]
    : user.role === "manager"
      ? [...navItems, ...managerItems]
      : navItems;

  const content = (
    <>
      <div className="p-5 border-b border-gray-200">
        <h1 className="text-xl font-black tracking-tight text-gray-900">homex</h1>
        <p className="text-[10px] tracking-[0.12em] uppercase text-gray-400 font-medium mt-0.5 font-mono-en">
          Quotation System
        </p>
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
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
            {user.name.charAt(0)}
          </div>
          <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate hover:underline">{user.name}</p>
            <p className="text-[11px] text-gray-400 font-mono-en">
              {ROLE_LABELS[user.role] || user.role}
            </p>
          </Link>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors font-semibold"
        >
          <LogOut className="w-4 h-4" />
          تسجيل الخروج
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 right-4 z-50 lg:hidden bg-gray-900 text-white p-2 rounded-lg shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 right-0 h-full w-64 bg-white border-l border-gray-200 flex flex-col z-40 transition-transform",
          "max-lg:translate-x-full",
          mobileOpen && "max-lg:translate-x-0"
        )}
      >
        {content}
      </aside>
    </>
  );
}
