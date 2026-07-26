import { getSettings } from "./settings";

// === Permission catalogue ===
// Each permission gates a menu item / area of the app. System roles map to a
// fixed set (matching the app's original admin/manager/sales behaviour), and
// managers can define custom roles that grant any subset of these.
export const PERMISSIONS = [
  "quotes",          // create / view own quotations, customers
  "view_all_quotes", // see every quotation, not only own
  "approve",         // approve / decline quotations
  "payments",        // record payments
  "invoices",        // issue invoices
  "edit_locked",     // edit a locked (signed / invoiced / paid) quotation
  "work_orders",     // work board, delivery & installation schedules, service
  "reports",         // reports & analytics
  "customers",       // manage customers
  "employees",       // manage employees & roles
  "categories",      // manage categories & pricing
  "settings",        // company settings
  "audit",           // audit & error logs
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface RoleDef {
  key: string;
  label: string;
  permissions: Permission[];
  system?: boolean;
}

// Built-in roles — their permissions reproduce the original hard-coded access
// (sales: own quotes + customers; manager: + work orders & reports; admin: all).
export const SYSTEM_ROLES: RoleDef[] = [
  { key: "admin", label: "مدير النظام", system: true, permissions: [...PERMISSIONS] },
  {
    key: "manager",
    label: "مشرف",
    system: true,
    permissions: ["quotes", "view_all_quotes", "approve", "payments", "invoices", "edit_locked", "work_orders", "reports", "customers"],
  },
  { key: "sales", label: "مبيعات", system: true, permissions: ["quotes", "customers", "payments"] },
];

// Custom roles are stored as JSON in the settings table (no schema change).
const CUSTOM_ROLES_KEY = "custom_roles";

export async function getAllRoles(): Promise<RoleDef[]> {
  const s = await getSettings();
  let custom: RoleDef[] = [];
  try {
    const raw = s[CUSTOM_ROLES_KEY];
    if (raw) custom = JSON.parse(raw);
  } catch {
    custom = [];
  }
  // System roles first, then valid custom roles (sanitised).
  const cleaned = custom
    .filter((r) => r && typeof r.key === "string" && r.key.trim())
    .map((r) => ({
      key: r.key.trim(),
      label: String(r.label || r.key).trim(),
      permissions: (Array.isArray(r.permissions) ? r.permissions : []).filter((p): p is Permission =>
        (PERMISSIONS as readonly string[]).includes(p)
      ),
      system: false,
    }));
  return [...SYSTEM_ROLES, ...cleaned];
}

export async function getRolePermissions(roleKey: string): Promise<Permission[]> {
  const roles = await getAllRoles();
  const role = roles.find((r) => r.key === roleKey);
  return role ? role.permissions : [];
}

export function roleHasPermissionIn(perms: Permission[], perm: Permission): boolean {
  return perms.includes(perm);
}

export { CUSTOM_ROLES_KEY };
