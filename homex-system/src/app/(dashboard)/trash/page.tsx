"use client";

import { useState, useEffect } from "react";
import { Trash2, RotateCcw, FileText, User, Loader2, Blinds } from "lucide-react";
import { cn } from "@/lib/utils";
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
interface DeletedCurtain {
  id: string; name: string; phone: string; place: string; bill: string;
  deliveryDate: string | null; deletedAt: string; deletedByName: string;
}

type ItemType = "quotation" | "customer" | "curtain";
type Tab = "quotations" | "curtains" | "customers";

export default function TrashPage() {
  const { t, locale, dateLocale } = useI18n();
  const toast = useToast();
  const [quotations, setQuotations] = useState<DeletedQuote[]>([]);
  const [customers, setCustomers] = useState<DeletedCustomer[]>([]);
  const [curtains, setCurtains] = useState<DeletedCurtain[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("quotations");

  const load = () =>
    fetch("/api/trash")
      .then((r) => (r.ok ? r.json() : { quotations: [], customers: [], curtains: [] }))
      .then((d) => { setQuotations(d.quotations || []); setCustomers(d.customers || []); setCurtains(d.curtains || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString(dateLocale, { dateStyle: "medium", timeStyle: "short" }) : "—");
  const fmtDay = (s: string | null) => (s ? new Date(s).toLocaleDateString(dateLocale, { dateStyle: "medium" }) : "—");

  const dropFrom = (type: ItemType, id: string) => {
    if (type === "quotation") setQuotations((p) => p.filter((q) => q.id !== id));
    else if (type === "curtain") setCurtains((p) => p.filter((c) => c.id !== id));
    else setCustomers((p) => p.filter((c) => c.id !== id));
  };

  const restore = async (type: ItemType, id: string) => {
    setBusy(id);
    try {
      const res = await fetch("/api/trash", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      if (res.ok) { toast.success(t("restore")); dropFrom(type, id); }
      else toast.error(t("errorOccurred"));
    } catch { toast.error(t("errorOccurred")); }
    finally { setBusy(null); }
  };

  const purge = async (type: ItemType, id: string) => {
    if (!confirm(t("confirmPermanentDelete"))) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/trash?type=${type}&id=${id}`, { method: "DELETE" });
      if (res.ok) { toast.success(t("permanentDelete")); dropFrom(type, id); }
      else toast.error(t("errorOccurred"));
    } catch { toast.error(t("errorOccurred")); }
    finally { setBusy(null); }
  };

  const rowActions = (type: ItemType, id: string) => (
    <div className="flex gap-2 shrink-0">
      <button onClick={() => restore(type, id)} disabled={busy === id}
        className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 rounded px-2.5 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50">
        {busy === id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} {t("restore")}
      </button>
      <button onClick={() => purge(type, id)} disabled={busy === id}
        className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-200 rounded px-2.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
        <Trash2 className="w-3.5 h-3.5" /> {t("permanentDelete")}
      </button>
    </div>
  );

  if (loading) return <div className="text-center py-20 text-gray-400">{t("loading")}</div>;

  const card = "flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3";
  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: "quotations", label: t("quotations"), icon: FileText, count: quotations.length },
    { key: "curtains", label: t("coTitle"), icon: Blinds, count: curtains.length },
    { key: "customers", label: t("customers"), icon: User, count: customers.length },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-5">
        <Trash2 className="w-6 h-6" /> {t("trash")}
      </h1>

      {/* Tabs per deletable type */}
      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={cn("flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold border transition-colors",
              tab === tb.key ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300")}>
            <tb.icon className="w-4 h-4" /> {tb.label}
            <span className={cn("text-[11px] font-mono-en px-1.5 py-0.5 rounded-full", tab === tb.key ? "bg-white/20" : "bg-gray-100 dark:bg-gray-700")}>{tb.count}</span>
          </button>
        ))}
      </div>

      {tab === "quotations" && (
        quotations.length === 0 ? <Empty t={t} /> : (
          <div className="space-y-2">
            {quotations.map((q) => (
              <div key={q.id} className={card}>
                <div className="min-w-0">
                  <p className="font-bold font-mono-en text-gray-800 dark:text-gray-100">{q.quoteNumber}</p>
                  <p className="text-sm text-gray-500 truncate">{displayName(q.customer?.name || "", locale)} · {(q.total || 0).toFixed(3)} {t("omr")}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t("deletedByLabel")}: {q.deletedByName || "—"} · {fmtDate(q.deletedAt)}</p>
                </div>
                {rowActions("quotation", q.id)}
              </div>
            ))}
          </div>
        )
      )}

      {tab === "curtains" && (
        curtains.length === 0 ? <Empty t={t} /> : (
          <div className="space-y-2">
            {curtains.map((c) => (
              <div key={c.id} className={card}>
                <div className="min-w-0">
                  <p className="font-bold text-gray-800 dark:text-gray-100 truncate">{c.name || "—"}</p>
                  <p className="text-sm text-gray-500 truncate font-mono-en">{c.phone || "—"}{c.place ? ` · ${c.place}` : ""}{c.bill ? ` · ${c.bill}` : ""} · {fmtDay(c.deliveryDate)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t("deletedByLabel")}: {c.deletedByName || "—"} · {fmtDate(c.deletedAt)}</p>
                </div>
                {rowActions("curtain", c.id)}
              </div>
            ))}
          </div>
        )
      )}

      {tab === "customers" && (
        customers.length === 0 ? <Empty t={t} /> : (
          <div className="space-y-2">
            {customers.map((c) => (
              <div key={c.id} className={card}>
                <div className="min-w-0">
                  <p className="font-bold text-gray-800 dark:text-gray-100">{displayName(c.name, locale)}</p>
                  <p className="text-sm text-gray-500 truncate font-mono-en">{c.phone} · {c.governorate} — {c.wilayat}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t("deletedByLabel")}: {c.deletedByName || "—"} · {fmtDate(c.deletedAt)}</p>
                </div>
                {rowActions("customer", c.id)}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Empty({ t }: { t: (k: any) => string }) {
  return (
    <div className="text-center py-16 text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
      {t("trashEmpty")}
    </div>
  );
}
