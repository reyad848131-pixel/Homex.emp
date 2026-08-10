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
  "work_orders",     // the work board (إدارة الأعمال) — drive jobs through the pipeline
  "workers",         // manage the workers list (العمّال) used in production tracking
  "deliveries",      // delivery / installation schedules & service (field ops)
  "deliveries_view", // read-only delivery schedule (e.g. the photographer)
  "photography",     // photography queue: shoot delivered/installed jobs
  "financials",      // may see money: prices, totals, payments, revenue
  "reports",         // reports & analytics
  "customers",       // manage customers
  "customers_view",  // read-only customers (name / contact / location only)
  "employees",       // manage employees & roles
  "categories",      // manage categories & pricing
  "settings",        // company settings
  "audit",           // audit & error logs
  "trash",           // view Trash, restore & permanently delete
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// Permissions a manager may grant to a CUSTOM role — limited to the ones the
// app actually enforces through this permission layer, so every checkbox works.
// Admin-only areas (employees/categories/settings/audit) and role-name-bound
// actions (approve/edit_locked) stay reserved for the built-in roles.
export const ASSIGNABLE_PERMISSIONS: Permission[] = [
  "quotes", "quotes_create", "view_all_quotes", "customers", "customers_view",
  "payments", "invoices", "work_orders", "workers", "deliveries", "deliveries_view",
  "photography", "financials", "reports",
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
  work_orders: "لوحة إدارة الأعمال (تحريك مراحل العمل)",
  workers: "إدارة قائمة العمّال (إضافة/تعديل)",
  deliveries: "جداول التسليم والتركيب والصيانة",
  deliveries_view: "عرض جدول التسليم (قراءة فقط)",
  photography: "التصوير (تصوير الأعمال المنجزة)",
  financials: "رؤية المبالغ (الأسعار والإيرادات والدفعات)",
  reports: "التقارير والإحصائيات",
  customers: "إدارة العملاء",
  customers_view: "عرض العملاء (قراءة فقط)",
  employees: "إدارة الموظفين والرتب",
  categories: "إدارة الفئات والأسعار",
  settings: "إعدادات الشركة",
  audit: "سجل التدقيق والأخطاء",
  trash: "المحذوفات (استرجاع وحذف نهائي)",
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
    permissions: ["quotes", "quotes_create", "view_all_quotes", "approve", "payments", "invoices", "edit_locked", "work_orders", "workers", "deliveries", "photography", "financials", "reports", "customers", "trash"],
  },
  { key: "sales", label: "مبيعات", system: true, permissions: ["quotes", "quotes_create", "customers", "payments", "financials"] },
  // Accountant: full financial visibility + creates/edits quotations, records
  // payments, issues invoices, and runs the work board & delivery schedules.
  // No settings / employees / pricing (categories).
  { key: "accountant", label: "محاسب", system: true, permissions: ["quotes", "quotes_create", "view_all_quotes", "customers", "payments", "invoices", "financials", "reports", "work_orders", "deliveries"] },
  // Driver: field ops only — delivery / installation schedules & service. No
  // access to the work board (can't drive job stages) and no money.
  { key: "driver", label: "سائق", system: true, permissions: ["deliveries"] },
  // Photographer: the photography queue, plus read-only delivery schedule and
  // read-only customers. No money anywhere.
  { key: "photographer", label: "مصوّر", system: true, permissions: ["photography", "deliveries_view", "customers_view"] },
  // Production supervisor / factory floor: the work board (drive job stages &
  // production tracking) and the workers list. No money, no admin areas.
  { key: "production", label: "مشرف إنتاج", system: true, permissions: ["work_orders", "workers"] },
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

// Field-ops (delivery/installation/service + work board) access helpers.
// "view" also admits the read-only delivery viewer (photographer); "edit"
// requires a mutating field-ops permission.
export async function canViewFieldOps(roleKey: string): Promise<boolean> {
  if (roleKey === "admin" || roleKey === "ceo" || roleKey === "manager") return true;
  const perms = await getRolePermissions(roleKey);
  return perms.includes("work_orders") || perms.includes("deliveries") || perms.includes("deliveries_view");
}
export async function canEditFieldOps(roleKey: string): Promise<boolean> {
  if (roleKey === "admin" || roleKey === "ceo" || roleKey === "manager") return true;
  const perms = await getRolePermissions(roleKey);
  return perms.includes("work_orders") || perms.includes("deliveries");
}

// Managing (editing/deleting) customers requires the full "customers"
// permission — the read-only "customers_view" (photographer) must not mutate.
export async function canManageCustomers(roleKey: string): Promise<boolean> {
  if (roleKey === "admin" || roleKey === "ceo" || roleKey === "manager") return true;
  return (await getRolePermissions(roleKey)).includes("customers");
}

// Convenience: does the given role grant the permission? (async settings read,
// cached). Use in API routes to gate access by capability instead of role name.
export async function userCan(roleKey: string, perm: Permission): Promise<boolean> {
  return (await getRolePermissions(roleKey)).includes(perm);
}

export { CUSTOM_ROLES_KEY };
