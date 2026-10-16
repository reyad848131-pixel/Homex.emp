"use client";

import { useEffect, useState } from "react";
import { Boxes, Plus, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { componentsForCategory, type ComponentDef, type SpecsCatalog } from "@/lib/specs-catalog";

export interface ItemComponentRow {
  id: string; name: string; status: string;
  arrivedAt: string | null; installedAt: string | null;
}

// Module-level caches so the catalog + the viewer's edit permission are fetched
// once for the whole page, no matter how many item panels are shown.
let catalogCache: Promise<SpecsCatalog> | null = null;
let canEditCache: Promise<boolean> | null = null;
function loadCatalog() {
  if (!catalogCache) catalogCache = fetch("/api/catalog").then((r) => (r.ok ? r.json() : { fields: [], components: [] })).catch(() => ({ fields: [], components: [] }));
  return catalogCache;
}
function loadCanEdit() {
  // The item-components API gates editing to the foreman/owner; we mirror that in
  // the UI by probing /api/me for the civil id / foreman access flag it returns.
  if (!canEditCache) canEditCache = fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then((m) => !!(m && (m.canForeman ?? m.foreman ?? m.isForeman ?? m.canEditComponents))).catch(() => false);
  return canEditCache;
}

const STATUS_META: Record<string, { key: TranslationKey; cls: string }> = {
  not_arrived: { key: "compNotArrived", cls: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300" },
  arrived:     { key: "compArrived",    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  installed:   { key: "compInstalled",  cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};
const ORDER = ["not_arrived", "arrived", "installed"];

export function ItemComponentsPanel({ itemId, categoryId, canEdit: canEditProp }: { itemId: string; categoryId?: string | null; canEdit?: boolean }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<ItemComponentRow[]>([]);
  const [defs, setDefs] = useState<ComponentDef[]>([]);
  const [canEdit, setCanEdit] = useState(!!canEditProp);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [custom, setCustom] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/item-components?itemId=${itemId}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      loadCatalog(),
      canEditProp === undefined ? loadCanEdit() : Promise.resolve(canEditProp),
    ]).then(([comps, catalog, edit]) => {
      if (!alive) return;
      setRows(Array.isArray(comps) ? comps : []);
      const all: SpecsCatalog = catalog;
      setDefs(categoryId ? componentsForCategory(all, categoryId) : all.components);
      setCanEdit(!!edit);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [itemId, categoryId, canEditProp]);

  const setStatus = async (id: string, status: string) => {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
    const res = await fetch("/api/item-components", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    if (!res.ok) toast.error(t("saveFailed"));
  };

  const addComponents = async (items: Array<{ catalogId?: string; name: string }>) => {
    const res = await fetch("/api/item-components", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, items }) });
    if (res.ok) { setRows(await res.json()); setPick(""); setCustom(""); setAdding(false); }
    else toast.error(t("saveFailed"));
  };

  const remove = async (id: string) => {
    setRows((p) => p.filter((r) => r.id !== id));
    await fetch(`/api/item-components?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  if (loading) return <div className="mt-3 text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> …</div>;
  if (rows.length === 0 && !canEdit) return null;

  return (
    <div className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-gray-500">
        <Boxes className="w-3.5 h-3.5" /> {t("compTitle")}
      </div>

      {rows.length === 0 && <p className="text-xs text-gray-400 mb-2">{t("compNone")}</p>}

      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 flex-wrap bg-gray-50 dark:bg-gray-900/40 rounded-lg px-2.5 py-1.5">
            <span className="text-sm font-semibold flex-1 min-w-0 truncate">{r.name}</span>
            {canEdit ? (
              <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                {ORDER.map((s) => (
                  <button key={s} onClick={() => setStatus(r.id, s)}
                    className={cn("px-2 py-1 text-[11px] font-bold transition-colors",
                      r.status === s ? STATUS_META[s].cls : "bg-white dark:bg-gray-800 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700")}>
                    {t(STATUS_META[s].key)}
                  </button>
                ))}
              </div>
            ) : (
              <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", STATUS_META[r.status]?.cls)}>{t(STATUS_META[r.status]?.key || "compNotArrived")}</span>
            )}
            {canEdit && <button onClick={() => remove(r.id)} className="text-gray-300 hover:text-red-500" title={t("delete")}><X className="w-3.5 h-3.5" /></button>}
          </div>
        ))}
      </div>

      {canEdit && (adding ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className="field h-9 text-sm">
            <option value="">{t("compPick")}</option>
            {defs.filter((d) => !rows.some((r) => r.name === (locale === "en" ? d.labelEn : d.labelAr))).map((d) => (
              <option key={d.id} value={d.id}>{locale === "en" ? d.labelEn : d.labelAr}</option>
            ))}
            <option value="__custom">{t("compCustom")}</option>
          </select>
          {pick === "__custom" && (
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t("compCustomPlaceholder")} className="field h-9 text-sm flex-1 min-w-[120px]" />
          )}
          <button
            onClick={() => {
              if (pick === "__custom") { if (custom.trim()) addComponents([{ name: custom.trim() }]); }
              else if (pick) { const d = defs.find((x) => x.id === pick); if (d) addComponents([{ catalogId: d.id, name: locale === "en" ? d.labelEn : d.labelAr }]); }
            }}
            className="h-9 px-3 rounded-lg bg-teal-600 text-white text-sm font-bold inline-flex items-center gap-1"><Check className="w-4 h-4" /> {t("compAddConfirm")}
          </button>
          <button onClick={() => { setAdding(false); setPick(""); setCustom(""); }} className="h-9 px-2 text-sm text-gray-400">{t("qdClose")}</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700">
          <Plus className="w-3.5 h-3.5" /> {t("compAdd")}
        </button>
      ))}
    </div>
  );
}
