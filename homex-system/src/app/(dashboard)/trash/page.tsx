"use client";

import { useState, useEffect } from "react";
import { Trash2, RotateCcw, FileText, User, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { displayName } from "@/lib/translit";
import { useToast } from "@/components/toast";

interface DeletedQuote {
  id: string; quoteNumber: string; total: number; status: string;
  deletedAt: string; deletedByName: string; customer: { name: string };
}
interface DeletedCustomer {
  id: string; name: string; phone: string; governorate: string; wilayat: string;
  deletedAt: string; deletedByName: string;
}

export default function TrashPage() {
  const { t, locale, dateLocale } = useI18n();
  const toast = useToast();
  const [quotations, setQuotations] = useState<DeletedQuote[]>([]);
  const [customers, setCustomers] = useState<DeletedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    fetch("/api/trash")
      .then((r) => (r.ok ? r.json() : { quotations: [], customers: [] }))
      .then((d) => { setQuotations(d.quotations || []); setCustomers(d.customers || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const fmtDate = (s: string) => new Date(s).toLocaleString(dateLocale, { dateStyle: "medium", timeStyle: "short" });

  const restore = async (type: "quotation" | "customer", id: string) => {
    setBusy(id);
    try {
      const res = await fetch("/api/trash", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      if (res.ok) {
        toast.success(t("restore"));
        if (type === "quotation") setQuotations((p) => p.filter((q) => q.id !== id));
        else setCustomers((p) => p.filter((c) => c.id !== id));
      } else toast.error(t("errorOccurred"));
    } catch { toast.error(t("errorOccurred")); }
    finally { setBusy(null); }
  };

  const purge = async (type: "quotation" | "customer", id: string) => {
    if (!confirm(t("confirmPermanentDelete"))) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/trash?type=${type}&id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("permanentDelete"));
        if (type === "quotation") setQuotations((p) => p.filter((q) => q.id !== id));
        else setCustomers((p) => p.filter((c) => c.id !== id));
      } else toast.error(t("errorOccurred"));
    } catch { toast.error(t("errorOccurred")); }
    finally { setBusy(null); }
  };

  const rowActions = (type: "quotation" | "customer", id: string) => (
    <div className="flex gap-2 shrink-0">
      <button onClick={() => restore(type, id)} disabled={busy === id}
        className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 rounded px-2.5 py-1.5 hover:bg-emerald-50 disabled:opacity-50">
        {busy === id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} {t("restore")}
      </button>
      <button onClick={() => purge(type, id)} disabled={busy === id}
        className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-200 rounded px-2.5 py-1.5 hover:bg-red-50 disabled:opacity-50">
        <Trash2 className="w-3.5 h-3.5" /> {t("permanentDelete")}
      </button>
    </div>
  );

  if (loading) return <div className="text-center py-20 text-gray-400">{t("loading")}</div>;

  const empty = quotations.length === 0 && customers.length === 0;

  return (
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <Trash2 className="w-6 h-6" /> {t("trash")}
      </h1>

      {empty && (
        <div className="text-center py-20 text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          {t("trashEmpty")}
        </div>
      )}

      {quotations.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" /> {t("deletedQuotationsLabel")} ({quotations.length})
          </h2>
          <div className="space-y-2">
            {quotations.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <p className="font-bold font-mono-en text-gray-800 dark:text-gray-100">{q.quoteNumber}</p>
                  <p className="text-sm text-gray-500 truncate">{displayName(q.customer?.name || "", locale)} · {(q.total || 0).toFixed(3)} {t("omr")}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t("deletedByLabel")}: {q.deletedByName || "—"} · {fmtDate(q.deletedAt)}</p>
                </div>
                {rowActions("quotation", q.id)}
              </div>
            ))}
          </div>
        </section>
      )}

      {customers.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> {t("deletedCustomersLabel")} ({customers.length})
          </h2>
          <div className="space-y-2">
            {customers.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <p className="font-bold text-gray-800 dark:text-gray-100">{displayName(c.name, locale)}</p>
                  <p className="text-sm text-gray-500 truncate font-mono-en">{c.phone} · {c.governorate} — {c.wilayat}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t("deletedByLabel")}: {c.deletedByName || "—"} · {fmtDate(c.deletedAt)}</p>
                </div>
                {rowActions("customer", c.id)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
