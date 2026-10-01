"use client";

import { useEffect, useState } from "react";
import { Layers, Save, Loader2, Plus, X, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";
import { DEFAULT_SPECS_CATALOG, type SpecField, type SpecsCatalog } from "@/lib/specs-catalog";

type Cat = { id: string; nameAr: string; nameEn: string };

function newField(): SpecField {
  return { id: `f${Date.now().toString(36)}`, labelAr: "", labelEn: "", options: [], categories: [] };
}

export default function CatalogClient({ categories }: { categories: Cat[] }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [fields, setFields] = useState<SpecField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Per-field draft text for the "add option" input.
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SpecsCatalog | null) => setFields(d?.fields?.length ? d.fields : DEFAULT_SPECS_CATALOG.fields))
      .catch(() => setFields(DEFAULT_SPECS_CATALOG.fields))
      .finally(() => setLoading(false));
  }, []);

  const patch = (i: number, p: Partial<SpecField>) =>
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...p } : f)));

  const addOption = (i: number) => {
    const f = fields[i];
    const v = (draft[f.id] || "").trim();
    if (!v) return;
    if (!f.options.includes(v)) patch(i, { options: [...f.options, v] });
    setDraft((d) => ({ ...d, [f.id]: "" }));
  };
  const removeOption = (i: number, opt: string) =>
    patch(i, { options: fields[i].options.filter((o) => o !== opt) });

  const toggleCat = (i: number, catId: string) => {
    const cur = fields[i].categories;
    patch(i, { categories: cur.includes(catId) ? cur.filter((c) => c !== catId) : [...cur, catId] });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setFields((data as SpecsCatalog).fields || []); toast.success(t("catalogSaved")); }
      else toast.error(data.error || t("saveFailed"));
    } catch {
      toast.error(t("serverConnectionError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> …</div>;
  }

  const card = "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5";

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5 pb-28">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-900/20 grid place-items-center text-teal-600 shrink-0">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t("catalogTitle")}</h1>
          <p className="text-sm text-gray-500">{t("catalogSubtitle")}</p>
        </div>
      </div>

      {fields.length === 0 && (
        <div className={cn(card, "text-center text-sm text-gray-400")}>{t("catNoFields")}</div>
      )}

      {fields.map((f, i) => (
        <div key={f.id} className={card}>
          <div className="flex items-start gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">{t("catFieldLabelAr")}</span>
                <input value={f.labelAr} onChange={(e) => patch(i, { labelAr: e.target.value })} className="field mt-1 w-full" dir="rtl" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">{t("catFieldLabelEn")}</span>
                <input value={f.labelEn} onChange={(e) => patch(i, { labelEn: e.target.value })} className="field mt-1 w-full font-mono-en" dir="ltr" />
              </label>
            </div>
            <button
              onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}
              className="mt-5 p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
              title={t("delete")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Options */}
          <div className="mt-4">
            <span className="text-xs font-semibold text-gray-500">{t("catOptions")}</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {f.options.length === 0 && <span className="text-xs text-gray-400">{t("catNoOptions")}</span>}
              {f.options.map((opt) => (
                <span key={opt} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-sm font-semibold">
                  {opt}
                  <button onClick={() => removeOption(i, opt)} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={draft[f.id] || ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(i); } }}
                placeholder={t("catOptionPlaceholder")}
                className="field flex-1"
              />
              <button onClick={() => addOption(i)} className="btn-secondary shrink-0 flex items-center gap-1"><Plus className="w-4 h-4" /> {t("catAddOption")}</button>
            </div>
          </div>

          {/* Category scope */}
          <div className="mt-4">
            <span className="text-xs font-semibold text-gray-500">{t("catAppliesTo")}</span>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold", f.categories.length === 0 ? "bg-teal-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-400")}>
                {t("catAllCategories")}
              </span>
              {categories.map((c) => {
                const on = f.categories.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCat(i, c.id)}
                    className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors", on ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-600 dark:border-gray-600" : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700")}
                  >
                    {locale === "ar" ? c.nameAr : c.nameEn}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      <button onClick={() => setFields((prev) => [...prev, newField()])} className="btn-secondary w-full flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> {t("catAddField")}
      </button>

      {/* Sticky save */}
      <div className="fixed bottom-0 inset-x-0 lg:ps-64 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-700 p-3 no-print">
        <div className="max-w-3xl mx-auto px-1">
          <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
