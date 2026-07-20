"use client";

import { useState, useEffect } from "react";
import { UsersRound, Plus, X, Shield, UserCheck, UserX } from "lucide-react";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  name: string;
  civilId: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  _count: { quotations: number };
}

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  manager: "مدير",
  sales: "مبيعات",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  manager: "bg-blue-100 text-blue-700",
  sales: "bg-green-100 text-green-700",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", civilId: "", phone: "", role: "sales", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => fetch("/api/employees").then((r) => r.json()).then(setEmployees);
  useEffect(() => { load(); }, []);

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
        const body: any = { name: form.name, phone: form.phone, role: form.role };
        if (form.password) body.password = form.password;
        const res = await fetch(`/api/employees/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) { setError("فشل التحديث"); return; }
      } else {
        if (!form.name || !form.civilId || !form.password) { setError("جميع الحقول مطلوبة"); return; }
        const res = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (res.status === 409) { setError("الرقم المدني مسجل مسبقاً"); return; }
        if (!res.ok) { setError("فشل الإضافة"); return; }
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
            إدارة الموظفين
          </h1>
          <p className="text-sm text-gray-500 mt-1">{employees.length} موظف</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-gray-800">
          <Plus className="w-4 h-4" />
          إضافة موظف
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">{editId ? "تعديل موظف" : "إضافة موظف جديد"}</h2>
            <button onClick={resetForm}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">الاسم *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">الرقم المدني *</label>
              <input type="text" value={form.civilId} onChange={(e) => setForm({ ...form, civilId: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" disabled={!!editId} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">الهاتف</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">الدور</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm">
                <option value="sales">مبيعات</option>
                <option value="manager">مدير</option>
                <option value="admin">مدير النظام</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                {editId ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور *"}
              </label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm" />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-3 font-semibold">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving}
              className="bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-gray-800 disabled:opacity-50">
              {saving ? "جاري الحفظ..." : editId ? "تحديث" : "إضافة"}
            </button>
            <button onClick={resetForm} className="px-5 py-2.5 border border-gray-200 rounded text-sm font-bold text-gray-600 hover:bg-gray-50">
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-right p-3 px-5 text-xs text-gray-400 font-semibold">الاسم</th>
              <th className="text-right p-3 text-xs text-gray-400 font-semibold">الرقم المدني</th>
              <th className="text-right p-3 text-xs text-gray-400 font-semibold">الدور</th>
              <th className="text-right p-3 text-xs text-gray-400 font-semibold">العروض</th>
              <th className="text-right p-3 text-xs text-gray-400 font-semibold">الحالة</th>
              <th className="text-right p-3 text-xs text-gray-400 font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-3 px-5 font-bold">{emp.name}</td>
                <td className="p-3 font-mono-en">{emp.civilId}</td>
                <td className="p-3">
                  <span className={cn("text-xs font-bold px-2 py-1 rounded-full", ROLE_COLORS[emp.role] || "bg-gray-100 text-gray-600")}>
                    {ROLE_LABELS[emp.role] || emp.role}
                  </span>
                </td>
                <td className="p-3 font-mono-en">{emp._count.quotations}</td>
                <td className="p-3">
                  <span className={cn("text-xs font-bold px-2 py-1 rounded-full",
                    emp.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500")}>
                    {emp.isActive ? "نشط" : "معطل"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(emp)}
                      className="text-xs font-bold text-gray-500 hover:text-gray-900 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">
                      تعديل
                    </button>
                    <button onClick={() => toggleActive(emp)}
                      className={cn("text-xs font-bold px-2 py-1 border rounded",
                        emp.isActive ? "text-red-500 border-red-200 hover:bg-red-50" : "text-green-600 border-green-200 hover:bg-green-50")}>
                      {emp.isActive ? "تعطيل" : "تفعيل"}
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
