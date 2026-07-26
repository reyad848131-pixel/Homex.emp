import { getSettings } from "./settings";

// === Permission catalogue ===
// Each permission gates a menu item / area of the app. System roles map to a
// fixed set (matching the app's original admin/manager/sales behaviour), and
// managers can define custom roles that grant any subset of these.
export const PERMISSIONS = [
  "quotes",          // view the quotations list & open quotes
  "quotes_create",   // create / edit quotations
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

// Permissions a manager may grant to a CUSTOM role — limited to the ones the
// app actually enforces through this permission layer, so every checkbox works.
// Admin-only areas (employees/categories/settings/audit) and role-name-bound
// actions (approve/edit_locked) stay reserved for the built-in roles.
export const ASSIGNABLE_PERMISSIONS: Permission[] = [
  "quotes", "quotes_create", "view_all_quotes", "customers",
  "payments", "invoices", "work_orders", "reports",
];

// Arabic labels for the role-management UI (kept here so the catalogue and its
// labels live together; served to the client via the /api/roles response).
export const PERMISSION_LABELS: Record<Permission, string> = {
  quotes: "عرض قائمة عروض الأسعار",
  quotes_create: "إنشاء وتعديل عروض الأسعار",
  view_all_quotes: "رؤية كل العروض (لا عروضه فقط)",
  approve: "اعتماد ورفض العروض",
  payments: "تسجيل الدفعات",
  invoices: "إصدار الفواتير",
  edit_locked: "تعديل العروض المقفلة",
  work_orders: "أوامر العمل والتسليم والتركيب والصيانة",
  reports: "التقارير والإحصائيات",
  customers: "إدارة العملاء",
  employees: "إدارة الموظفين والرتب",
  categories: "إدارة الفئات والأسعار",
  settings: "إعدادات الشركة",
  audit: "سجل التدقيق والأخطاء",
};

export interface RoleDef {
  key: string;
  label: string;
  permissions: Permission[];
  system?: boolean;
  // A singleton role may be held by at most one employee at a time (e.g. CEO).
  singleton?: boolean;
}

// Built-in roles — their permissions reproduce the original hard-coded access
// (sales: own quotes + customers; manager: + work orders & reports; admin: all).
export const SYSTEM_ROLES: RoleDef[] = [
  // CEO: full access like the system admin, but limited to a single person.
  { key: "ceo", label: "مدير تنفيذي (CEO)", system: true, singleton: true, permissions: [...PERMISSIONS] },
  { key: "admin", label: "مدير النظام", system: true, permissions: [...PERMISSIONS] },
  {
    key: "manager",
    label: "مشرف",
    system: true,
    permissions: ["quotes", "quotes_create", "view_all_quotes", "approve", "payments", "invoices", "edit_locked", "work_orders", "reports", "customers"],
  },
  { key: "sales", label: "مبيعات", system: true, permissions: ["quotes", "quotes_create", "customers", "payments"] },
  // Accountant: sees every quotation + customers + reports, records payments and
  // issues invoices; cannot create quotes, and no settings / employees / pricing.
  { key: "accountant", label: "محاسب", system: true, permissions: ["quotes", "view_all_quotes", "customers", "payments", "invoices", "reports"] },
  // Driver: only the delivery / installation / work board / service.
  { key: "driver", label: "سائق", system: true, permissions: ["work_orders"] },
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

// Convenience: does the given role grant the permission? (async settings read,
// cached). Use in API routes to gate access by capability instead of role name.
export async function userCan(roleKey: string, perm: Permission): Promise<boolean> {
  return (await getRolePermissions(roleKey)).includes(perm);
}

export { CUSTOM_ROLES_KEY };
