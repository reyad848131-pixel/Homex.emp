"use client";

import { useState, useEffect } from "react";
import { UsersRound, Plus, X, Shield, UserCheck, UserX, KeyRound, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface Employee {
  id: string;
  name: string;
  civilId: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  _count: { quotations: number };
}

const ROLE_KEYS: Record<string, TranslationKey> = {
  ceo: "roleCeo",
  admin: "roleAdmin",
  manager: "roleManager",
  sales: "roleSales",
  accountant: "roleAccountant",
  driver: "roleDriver",
};

const ROLE_COLORS: Record<string, string> = {
  ceo: "bg-gray-900 text-white",
  admin: "bg-red-100 text-red-700",
  manager: "bg-blue-100 text-blue-700",
  sales: "bg-green-100 text-green-700",
  accountant: "bg-amber-100 text-amber-700",
  driver: "bg-purple-100 text-purple-700",
};

interface RoleDef { key: string; label: string; permissions: string[]; system?: boolean }

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", civilId: "", phone: "", role: "sales", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<Array<{ name: string; civilId: string; password: string }> | null>(null);
  // Roles & permissions management.
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [permCatalog, setPermCatalog] = useState<Array<{ key: string; label: string }>>([]);
  const [showRoles, setShowRoles] = useState(false);
  const [roleForm, setRoleForm] = useState<{ key?: string; label: string; permissions: string[] } | null>(null);
  const [roleError, setRoleError] = useState("");
  const { t } = useI18n();

  const loadRoles = () =>
    fetch("/api/roles")
      .then((r) => (r.ok ? r.json() : { roles: [], permissions: [] }))
      .then((d) => { setRoles(d.roles || []); setPermCatalog(d.permissions || []); })
      .catch(() => {});

  const roleLabel = (key: string) =>
    roles.find((r) => r.key === key)?.label || (ROLE_KEYS[key] ? t(ROLE_KEYS[key]) : key);

  const saveRole = async () => {
    if (!roleForm) return;
    if (!roleForm.label.trim()) { setRoleError(t("roleNameRequired")); return; }
    setRoleError("");
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roleForm),
    });
    if (res.ok) { setRoleForm(null); loadRoles(); }
    else { const d = await res.json().catch(() => ({})); setRoleError(d.error || t("errorOccurred")); }
  };

  const deleteRole = async (key: string) => {
    if (!confirm(t("deleteRoleConfirm"))) return;
    const res = await fetch(`/api/roles?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    if (res.ok) loadRoles();
    else { const d = await res.json().catch(() => ({})); alert(d.error || t("errorOccurred")); }
  };

  const togglePerm = (p: string) => {
    if (!roleForm) return;
    const has = roleForm.permissions.includes(p);
    setRoleForm({ ...roleForm, permissions: has ? roleForm.permissions.filter((x) => x !== p) : [...roleForm.permissions, p] });
  };

  const handleResetPasswords = async () => {
    if (!confirm(t("resetPasswordsConfirm"))) return;
    setResetting(true);
    try {
      const res = await fetch("/api/employees/reset-passwords", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setResetResult(data.employees || []);
      } else {
        setError(t("addFailed"));
      }
    } catch { setError(t("serverConnectionError")); }
    finally { setResetting(false); }
  };

  const load = () => fetch("/api/employees").then((r) => r.json()).then(setEmployees);
  useEffect(() => { load(); loadRoles(); }, []);

  const resetForm = () => {
    setForm({ name: "", civilId: "", phone: "", role: "sales", password: "" });
    setShowForm(false);
    setEditId(null);
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      if (editId) {
        if (form.password && form.password.length < 6) { setError(t("passwordMinHint")); return; }
        const body: any = { name: form.name, phone: form.phone, role: form.role };
        if (form.password) body.password = form.password;
        const res = await fetch(`/api/employees/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.code === "singleton" ? d.error : t("updateFailed"));
          return;
        }
      } else {
        if (!form.name || !form.civilId || !form.password) { setError(t("allFieldsRequired")); return; }
        if (form.password.length < 6) { setError(t("passwordMinHint")); return; }
        const res = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          if (d.code === "singleton") setError(d.error);
          else if (res.status === 409) setError(t("civilIdExists"));
          else setError(t("addFailed"));
          return;
        }
      }
      resetForm();
      load();
    } finally { setSaving(false); }
  };

  const toggleActive = async (emp: Employee) => {
    await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !emp.isActive }),
    });
    load();
  };

  const startEdit = (emp: Employee) => {
    setForm({ name: emp.name, civilId: emp.civilId, phone: emp.phone || "", role: emp.role, password: "" });
    setEditId(emp.id);
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UsersRound className="w-6 h-6" />
            {t("employeesManagement")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{employees.length} {t("employeeCount")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRoles((v) => !v)}
            className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700">
            <Shield className="w-4 h-4" />
            {t("rolesAndPermissions")}
          </button>
          <button onClick={handleResetPasswords} disabled={resetting}
            className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
            <KeyRound className="w-4 h-4" />
            {resetting ? t("savingText") : t("resetPasswordsBtn")}
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-gray-800">
            <Plus className="w-4 h-4" />
            {t("addEmployee")}
          </button>
        </div>
      </div>

      {resetResult && (
        <div className="mb-6 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> {t("resetPasswordsDone").replace("{n}", String(resetResult.length))}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">{t("resetPasswordsNote")}</p>
            </div>
            <button onClick={() => setResetResult(null)} className="text-emerald-700 dark:text-emerald-300"><X className="w-4 h-4" /></button>
          </div>
          {resetResult.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-emerald-200 dark:border-emerald-800">
                    <th className="text-right py-1.5 px-2">{t("nameLabel")}</th>
                    <th className="text-right py-1.5 px-2">{t("civilId")}</th>
                    <th className="text-right py-1.5 px-2">{t("password")}</th>
                  </tr>
                </thead>
                <tbody>
                  {resetResult.map((r) => (
                    <tr key={r.civilId} className="border-b border-emerald-100 dark:border-emerald-900/40">
                      <td className="py-1.5 px-2 font-semibold">{r.name}</td>
                      <td className="py-1.5 px-2 font-mono-en">{r.civilId}</td>
                      <td className="py-1.5 px-2 font-mono-en font-bold" dir="ltr">{r.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => navigator.clipboard?.writeText(resetResult.map((r) => `${r.name} — ${r.civilId} — ${r.password}`).join("\n"))}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline">
                <Copy className="w-3.5 h-3.5" /> {t("copyAll")}
              </button>
            </div>
          )}
        </div>
      )}

      {showRoles && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2"><Shield className="w-4 h-4" /> {t("rolesAndPermissions")}</h2>
            <div className="flex items-center gap-2">
              {!roleForm && (
                <button onClick={() => { setRoleError(""); setRoleForm({ label: "", permissions: [] }); }}
                  className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-800">
                  <Plus className="w-3.5 h-3.5" /> {t("newRole")}
                </button>
              )}
              <button onClick={() => { setShowRoles(false); setRoleForm(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
          </div>

          {roleForm && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-900/30">
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1.5">{t("roleNameLabel")}</label>
              <input value={roleForm.label} onChange={(e) => setRoleForm({ ...roleForm, label: e.target.value })}
                className="field mb-3 max-w-xs" placeholder={t("roleNameLabel")} />
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">{t("permissionsLabel")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {permCatalog.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-white dark:hover:bg-gray-800">
                    <input type="checkbox" checked={roleForm.permissions.includes(p.key)} onChange={() => togglePerm(p.key)} className="rounded" />
                    {p.label}
                  </label>
                ))}
              </div>
              {roleError && <p className="text-red-600 text-sm mt-2 font-semibold">{roleError}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={saveRole} className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-bold hover:bg-gray-800">{t("saveBtn")}</button>
                <button onClick={() => { setRoleForm(null); setRoleError(""); }} className="px-4 py-2 border border-gray-200 rounded text-sm font-bold text-gray-600 hover:bg-gray-50">{t("cancel")}</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {roles.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-3 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", ROLE_COLORS[r.key] || "bg-gray-100 text-gray-600")}>{r.label}</span>
                    {r.system
                      ? <span className="text-[10px] text-gray-400 font-semibold">{t("systemRole")}</span>
                      : <span className="text-[10px] text-emerald-600 font-semibold">{t("customRole")}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {r.permissions.length === 0 ? "—" : r.permissions.map((p) => permCatalog.find((c) => c.key === p)?.label || p).join(" · ")}
                  </p>
                </div>
                {!r.system && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setRoleError(""); setRoleForm({ key: r.key, label: r.label, permissions: [...r.permissions] }); }}
                      className="text-xs font-bold text-gray-500 hover:text-gray-900 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">{t("edit")}</button>
                    <button onClick={() => deleteRole(r.key)}
                      className="text-xs font-bold text-red-500 border border-red-200 rounded px-2 py-1 hover:bg-red-50">{t("delete")}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">{editId ? t("editEmployee") : t("addNewEmployee")}</h2>
            <button onClick={resetForm}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("nameLabel")} *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("civilIdLabel")} *</label>
              <input type="text" value={form.civilId} onChange={(e) => setForm({ ...form, civilId: e.target.value })}
                className="field font-mono-en disabled:opacity-60 disabled:bg-gray-50 dark:disabled:bg-gray-900/40" disabled={!!editId} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("phone")}</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="field font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("role")}</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="field">
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                {editId ? t("newPasswordOptional") : `${t("password")} *`}
              </label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="field" minLength={6} placeholder={editId ? "" : "••••••"} />
              <p className={cn("text-xs mt-1", form.password && form.password.length > 0 && form.password.length < 6 ? "text-red-500 font-semibold" : "text-gray-400")}>
                {t("passwordMinHint")}
              </p>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-3 font-semibold">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving}
              className="bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-gray-800 disabled:opacity-50">
              {saving ? t("savingText") : editId ? t("updateBtn") : t("addBtn")}
            </button>
            <button onClick={resetForm} className="px-5 py-2.5 border border-gray-200 rounded text-sm font-bold text-gray-600 hover:bg-gray-50">
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-right p-3 px-5 text-xs text-gray-400 font-semibold">{t("nameLabel")}</th>
              <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("civilIdLabel")}</th>
              <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("role")}</th>
              <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("quotesLabel")}</th>
              <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("status")}</th>
              <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-3 px-5 font-bold">{emp.name}</td>
                <td className="p-3 font-mono-en">{emp.civilId}</td>
                <td className="p-3">
                  <span className={cn("text-xs font-bold px-2 py-1 rounded-full", ROLE_COLORS[emp.role] || "bg-gray-100 text-gray-600")}>
                    {roleLabel(emp.role)}
                  </span>
                </td>
                <td className="p-3 font-mono-en">{emp._count.quotations}</td>
                <td className="p-3">
                  <span className={cn("text-xs font-bold px-2 py-1 rounded-full",
                    emp.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500")}>
                    {emp.isActive ? t("activeStatus") : t("disabledStatus")}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(emp)}
                      className="text-xs font-bold text-gray-500 hover:text-gray-900 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">
                      {t("edit")}
                    </button>
                    <button onClick={() => toggleActive(emp)}
                      className={cn("text-xs font-bold px-2 py-1 border rounded",
                        emp.isActive ? "text-red-500 border-red-200 hover:bg-red-50" : "text-green-600 border-green-200 hover:bg-green-50")}>
                      {emp.isActive ? t("disable") : t("enable")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
