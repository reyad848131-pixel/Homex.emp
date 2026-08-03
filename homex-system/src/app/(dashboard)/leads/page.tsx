"use client";

import { useState, useEffect, useCallback } from "react";
import { Inbox, Phone, MapPin, Check, UserPlus, Archive, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  governorate: string | null;
  wilayat: string | null;
  service: string | null;
  message: string | null;
  status: string;
  convertedCustomerId: string | null;
  createdAt: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: "جديد", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  contacted: { label: "تم التواصل", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  converted: { label: "تحوّل لعميل", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  archived: { label: "مؤرشف", cls: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
};

const FILTERS = [
  ["new", "الجديدة"],
  ["contacted", "تم التواصل"],
  ["converted", "المحوّلة"],
  ["all", "الكل"],
] as const;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("new");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/leads?status=${filter}&limit=100`);
    const data = await res.json().catch(() => ({ leads: [] }));
    setLeads(data.leads || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, payload: Record<string, unknown>) {
    setBusy(id);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (payload.action === "convert" && data.customerId) {
        window.location.href = `/customers/${data.customerId}`;
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Inbox className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        <h1 className="text-2xl font-bold">العملاء المحتملون</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">طلبات واردة من موقع الشركة — راجعها وحوّل الجاد منها إلى عميل.</p>

      <div className="flex gap-1.5 flex-wrap mb-5">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={cn("px-4 py-1.5 rounded-full text-xs font-bold border transition-colors",
              filter === k ? "bg-gray-900 border-gray-900 text-white" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500")}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : leads.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
          لا توجد طلبات في هذا التصنيف
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => {
            const st = STATUS_META[l.status] ?? STATUS_META.new;
            return (
              <div key={l.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-gray-100">{l.name}</span>
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", st.cls)}>{st.label}</span>
                      {l.service && <span className="text-[11px] font-semibold text-gray-500 border border-gray-200 dark:border-gray-700 rounded px-2 py-0.5">{l.service}</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                      {l.phone && <a href={`tel:${l.phone}`} className="flex items-center gap-1 font-mono-en hover:text-emerald-600"><Phone className="w-3.5 h-3.5" />{l.phone}</a>}
                      {(l.governorate || l.wilayat) && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{[l.governorate, l.wilayat].filter(Boolean).join(" – ")}</span>}
                      <span className="text-xs text-gray-400 font-mono-en">{new Date(l.createdAt).toLocaleString("ar")}</span>
                    </div>
                    {l.message && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded p-2.5">{l.message}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {l.phone && (
                      <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener"
                        className="px-3 py-1.5 rounded border border-emerald-300 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20">واتساب</a>
                    )}
                    {l.status !== "converted" && (
                      <>
                        {l.status === "new" && (
                          <button disabled={busy === l.id} onClick={() => act(l.id, { status: "contacted" })}
                            className="px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 disabled:opacity-40">
                            <Check className="w-3.5 h-3.5" />تم التواصل
                          </button>
                        )}
                        <button disabled={busy === l.id} onClick={() => act(l.id, { action: "convert" })}
                          className="px-3 py-1.5 rounded bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 flex items-center gap-1 disabled:opacity-40">
                          {busy === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}تحويل لعميل
                        </button>
                        <button disabled={busy === l.id} onClick={() => act(l.id, { status: "archived" })} title="أرشفة"
                          className="p-1.5 rounded border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-700 disabled:opacity-40">
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {l.status === "converted" && l.convertedCustomerId && (
                      <a href={`/customers/${l.convertedCustomerId}`} className="px-3 py-1.5 rounded border border-blue-300 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20">فتح العميل</a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
