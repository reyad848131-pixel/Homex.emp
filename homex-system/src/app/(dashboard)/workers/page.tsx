"use client";

import { useState, useEffect } from "react";
import { HardHat, Plus, Pencil, Trash2, Check, Power } from "lucide-react";
import { useToast } from "@/components/toast";
import { useI18n } from "@/lib/i18n";
import { WORKER_COLORS, initials } from "@/lib/workers";
import { cn } from "@/lib/utils";

interface Worker {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

function Avatar({ color, name, size = 40 }: { color: string; name: string; size?: number }) {
  return (
    <span className="grid place-items-center rounded-xl font-black shrink-0"
      style={{ width: size, height: size, background: color, color: "#0c0c0e", fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {WORKER_COLORS.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className={cn("w-7 h-7 rounded-lg transition-transform", value === c ? "ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-gray-900 scale-110" : "hover:scale-110")}
          style={{ background: c }} aria-label={c} />
      ))}
    </div>
  );
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(WORKER_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { t } = useI18n();

  const load = () => {
    setLoading(true);
    fetch("/api/workers?all=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((w) => setWorkers(Array.isArray(w) ? w : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditingId(null); setName("");
    const used = workers.map((w) => w.color);
    setColor(WORKER_COLORS.find((c) => !used.includes(c)) || WORKER_COLORS[0]);
    setShowForm(true);
  };
  const openEdit = (w: Worker) => { setEditingId(w.id); setName(w.name); setColor(w.color); setShowForm(true); };
  const cancel = () => { setShowForm(false); setEditingId(null); setName(""); };

  const save = async () => {
    if (!name.trim()) { toast.error(t("wkEnterName")); return; }
    setSaving(true);
    try {
      const res = editingId
        ? await fetch(`/api/workers/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, color }) })
        : await fetch("/api/workers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, color }) });
      if (!res.ok) { toast.error(t("wkSaveFailed")); return; }
      toast.success(editingId ? t("wkUpdated") : t("wkAdded"));
      cancel(); load();
    } catch { toast.error(t("wkSaveError")); }
    finally { setSaving(false); }
  };

  const toggleActive = async (w: Worker) => {
    setWorkers((prev) => prev.map((x) => (x.id === w.id ? { ...x, isActive: !x.isActive } : x)));
    await fetch(`/api/workers/${w.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !w.isActive }) }).catch(() => load());
  };

  const remove = async (w: Worker) => {
    if (!confirm(t("wkDeleteConfirm"))) return;
    const res = await fetch(`/api/workers/${w.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (data.deactivated) toast.success(t("wkDeactivated"));
    else toast.success(t("wkDeleted"));
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><HardHat className="w-6 h-6" /> {t("workers")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("wkSubtitle")}</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 px-4 h-11 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold">
          <Plus className="w-4 h-4" /> {t("wkAdd")}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
          <h2 className="font-bold mb-4">{editingId ? t("wkEditTitle") : t("wkNew")}</h2>
          <div className="flex items-center gap-4 mb-4">
            <Avatar color={color} name={name || "؟"} size={52} />
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 block mb-1">{t("wkName")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder={t("wkNamePh")} autoFocus />
            </div>
          </div>
          <label className="text-xs font-bold text-gray-500 block mb-2">{t("wkColor")}</label>
          <ColorPicker value={color} onChange={setColor} />
          <div className="flex gap-2 mt-5">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-bold disabled:opacity-50">
              <Check className="w-4 h-4" /> {saving ? t("savingDots") : t("save")}
            </button>
            <button onClick={cancel} className="px-4 h-10 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300">{t("cancel")}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">{t("loadingDots")}</div>
      ) : workers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center">
          <HardHat className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">{t("wkNone")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {workers.map((w) => (
            <div key={w.id} className={cn(
              "bg-white dark:bg-gray-800 border rounded-xl p-4 flex items-center gap-3 transition-opacity",
              w.isActive ? "border-gray-200 dark:border-gray-700" : "border-gray-200 dark:border-gray-700 opacity-55"
            )}>
              <Avatar color={w.color} name={w.name} />
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{w.name}</div>
                <div className="text-[11px] font-bold" style={{ color: w.isActive ? undefined : "#9ca3af" }}>
                  {w.isActive ? <span className="text-emerald-600 dark:text-emerald-400">{t("wkActive")}</span> : t("wkInactive")}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleActive(w)} title={w.isActive ? t("wkDeactivate") : t("wkActivate")}
                  className="w-8 h-8 grid place-items-center rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"><Power className="w-4 h-4" /></button>
                <button onClick={() => openEdit(w)} title={t("edit")}
                  className="w-8 h-8 grid place-items-center rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(w)} title={t("delete")}
                  className="w-8 h-8 grid place-items-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
