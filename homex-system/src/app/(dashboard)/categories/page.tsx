"use client";

import { useState, useEffect } from "react";
import { Layers, Plus, Pencil, Trash2, X, Check, RotateCcw } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string | null;
  pricingType: string;
  basePrice: number | null;
  isActive: boolean;
  sortOrder: number;
  _count: { items: number };
}

const PRICING_TYPE_KEYS: Record<string, TranslationKey> = {
  fixed: "fixedPrice",
  per_meter: "perMeter",
  per_unit: "perUnit",
  custom: "customPrice",
};

const PRICING_VALUES = ["fixed", "per_meter", "per_unit", "custom"] as const;

const emptyForm = { nameAr: "", nameEn: "", icon: "", pricingType: "fixed", basePrice: "", sortOrder: "0" };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { t, locale } = useI18n();

  const load = () => {
    setLoading(true);
    fetch("/api/categories?all=true")
      .then((r) => r.json())
      .then((data) => { setCategories(data); setLoading(false); });
  };

  useEffect(load, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (c: Category) => {
    setForm({
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      icon: c.icon || "",
      pricingType: c.pricingType,
      basePrice: c.basePrice?.toString() || "",
      sortOrder: c.sortOrder.toString(),
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr || !form.nameEn) return;
    setSaving(true);

    const url = editingId ? `/api/categories/${editingId}` : "/api/categories";
    const method = editingId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);
    resetForm();
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    load();
  };

  const handleReactivate = async (c: Category) => {
    await fetch(`/api/categories/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...c, isActive: true }),
    });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="w-6 h-6" />
            {t("categoriesManagement")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("categoriesDescription")}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded text-sm font-bold hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("newCategory")}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">
              {editingId ? t("editCategory") : t("addNewCategory")}
            </h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("nameAr")}</label>
              <input
                type="text" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("nameEn")}</label>
              <input
                type="text" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("iconEmoji")}</label>
              <input
                type="text" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm text-center text-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("pricingType")}</label>
              <select
                value={form.pricingType} onChange={(e) => setForm({ ...form, pricingType: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-white"
              >
                {PRICING_VALUES.map((v) => (
                  <option key={v} value={v}>{t(PRICING_TYPE_KEYS[v])}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("basePrice")} (ر.ع)</label>
              <input
                type="number" step="0.001" min="0" value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" placeholder="0.000"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t("sortOrder")}</label>
              <input
                type="number" min="0" value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm font-mono-en" placeholder="0"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3">
              <button
                type="submit" disabled={saving}
                className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                <Check className="w-4 h-4" />
                {saving ? t("savingText") : editingId ? t("updateBtn") : t("addBtn")}
              </button>
              <button type="button" onClick={resetForm}
                className="px-6 py-2.5 rounded text-sm font-bold border border-gray-200 hover:bg-gray-50 transition-colors">
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
        {loading ? (
          <div className="p-12 text-center text-gray-400">{t("loading")}</div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">{t("noCategoriesYet")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-right p-3 px-5 text-xs text-gray-400 font-semibold">{t("orderCol")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("iconCol")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("nameCol")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("nameEnCol")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("pricingCol")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("basePriceCol")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("items")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("status")}</th>
                  <th className="text-right p-3 text-xs text-gray-400 font-semibold">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!c.isActive ? "opacity-50" : ""}`}>
                    <td className="p-3 px-5 font-mono-en text-gray-400 text-xs">{c.sortOrder}</td>
                    <td className="p-3 text-xl">{c.icon || "—"}</td>
                    <td className="p-3 font-bold text-gray-900">{c.nameAr}</td>
                    <td className="p-3 font-mono-en text-gray-500 text-xs">{c.nameEn}</td>
                    <td className="p-3">
                      <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 text-gray-600">
                        {PRICING_TYPE_KEYS[c.pricingType] ? t(PRICING_TYPE_KEYS[c.pricingType]) : c.pricingType}
                      </span>
                    </td>
                    <td className="p-3 font-mono-en font-bold">{c.basePrice ? `${c.basePrice.toFixed(3)}` : "—"}</td>
                    <td className="p-3 font-mono-en text-gray-400 text-xs">{c._count.items}</td>
                    <td className="p-3">
                      {c.isActive ? (
                        <span className="text-xs font-bold px-2 py-1 rounded bg-green-50 text-green-600">{t("activeStatus")}</span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-1 rounded bg-red-50 text-red-600">{t("disabledStatus")}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(c)} className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                          <Pencil className="w-4 h-4 text-gray-400" />
                        </button>
                        {c.isActive ? (
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-50 rounded transition-colors">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        ) : (
                          <button onClick={() => handleReactivate(c)} className="p-1.5 hover:bg-green-50 rounded transition-colors">
                            <RotateCcw className="w-4 h-4 text-green-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
