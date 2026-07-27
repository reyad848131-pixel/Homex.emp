"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useDebouncedValue } from "@/lib/hooks";
import { useToast } from "@/components/toast";
import { CardsSkeleton } from "@/components/skeleton";
import {
  Camera, Phone, MessageCircle, Check, FileText, Search,
  MapPin, User, RotateCcw, Package, CalendarDays,
} from "lucide-react";

interface PhotoQuotation {
  id: string;
  quoteNumber: string;
  total: number;
  workStatus: string | null;
  deliveryLocation: string | null;
  deliveryDate: string | null;
  workNotes: string | null;
  photoStatus: string | null;
  photographer: string | null;
  photographedAt: string | null;
  photoNotes: string | null;
  customer: { name: string; phone: string; phoneCode: string; governorate: string; wilayat: string; address: string | null };
  employee: { name: string };
  items: Array<{ description: string; quantity: number }>;
}

export default function PhotographyPage() {
  const { t, dateLocale } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState<"queue" | "done">("queue");
  const [rows, setRows] = useState<PhotoQuotation[] | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [photographers, setPhotographers] = useState<string[]>([]);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");

  const fetchData = useCallback(() => {
    setRows(null);
    const params = new URLSearchParams({ photoStatus: tab === "queue" ? "ready" : "done" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    fetch(`/api/photography?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.quotations || []))
      .catch(() => setRows([]));
  }, [tab, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Photographer names for the assignment dropdown (fall back to all active
  // employees if none carry the photographer role yet).
  useEffect(() => {
    fetch("/api/employees")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: any[]) => {
        const active = (list || []).filter((e) => e.isActive !== false);
        const shooters = active.filter((e) => e.role === "photographer").map((e) => e.name);
        setPhotographers(shooters.length ? shooters : active.map((e) => e.name));
      })
      .catch(() => {});
  }, []);

  const patch = (id: string, body: Record<string, any>, patchLocal: Partial<PhotoQuotation>) => {
    setRows((prev) => (prev ? prev.map((q) => (q.id === id ? { ...q, ...patchLocal } : q)) : prev));
    fetch("/api/photography", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    }).catch(() => fetchData());
  };

  const markPhotographed = (q: PhotoQuotation) => {
    if (!confirm(t("confirmPhotographed"))) return;
    setRows((prev) => (prev ? prev.filter((r) => r.id !== q.id) : prev));
    fetch("/api/photography", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: q.id, photoStatus: "done" }),
    }).then(() => toast.success(t("photographedOn"))).catch(() => fetchData());
  };

  const needsReshoot = (q: PhotoQuotation) => {
    const reason = prompt(t("reshootReasonPrompt"), q.photoNotes || "");
    if (reason === null) return; // cancelled
    setRows((prev) => (prev ? prev.filter((r) => r.id !== q.id) : prev));
    fetch("/api/photography", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: q.id, photoStatus: "ready", photoNotes: reason }),
    }).catch(() => fetchData());
  };

  const saveNote = () => {
    if (!noteId) return;
    const id = noteId;
    const val = noteValue.trim();
    setNoteId(null);
    patch(id, { photoNotes: val }, { photoNotes: val || null });
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(dateLocale, { year: "numeric", month: "short", day: "numeric" });

  const waLink = (q: PhotoQuotation) => {
    const num = `${q.customer.phoneCode}${q.customer.phone}`.replace(/[^0-9]/g, "");
    return `https://wa.me/${num}`;
  };
  const telLink = (q: PhotoQuotation) => `tel:${q.customer.phoneCode}${q.customer.phone}`;
  const preciseHref = (loc: string) =>
    loc.trim().startsWith("http") ? loc.trim() : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.trim())}`;
  const areaHref = (q: PhotoQuotation) => {
    const query = [q.customer.address, q.customer.wilayat, q.customer.governorate, "Oman"].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  const total = rows?.length ?? 0;
  const empty = useMemo(() => rows !== null && rows.length === 0, [rows]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Camera className="w-6 h-6" />
            {t("photographyTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("photographySubtitle")}</p>
        </div>
        <span className="inline-flex items-center gap-2 self-start bg-teal-600 text-white px-4 h-11 rounded-lg text-sm font-bold">
          <Camera className="w-4 h-4" />
          <span className="font-mono-en">{total}</span> {t("photoCount")}
        </span>
      </div>

      {/* Tabs + search */}
      <div className="space-y-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          {(["queue", "done"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn("px-4 h-10 rounded-lg text-sm font-bold border transition-colors",
                tab === k ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400")}>
              {k === "queue" ? t("tabPhotoQueue") : t("tabPhotographed")}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPhotoJobs")} className="field pr-10" />
        </div>
      </div>

      {rows === null ? (
        <CardsSkeleton />
      ) : empty ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-400">
          <Camera className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-semibold">{tab === "queue" ? t("noPhotoJobs") : t("noPhotographedYet")}</p>
          {tab === "queue" && <p className="text-sm mt-1">{t("noPhotoJobsHint")}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((q) => (
            <div key={q.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3">
              {/* Top: quote + customer */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white truncate">{q.customer.name}</p>
                  <Link href={`/quotations/${q.id}`} className="text-xs text-gray-400 font-mono-en hover:underline flex items-center gap-1">
                    <FileText className="w-3 h-3" /> {q.quoteNumber}
                  </Link>
                </div>
                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 shrink-0 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {q.workStatus === "installed" ? t("installedLabel") : t("deliveredStatus")}
                </span>
              </div>

              {/* Area */}
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {q.customer.governorate} — {q.customer.wilayat}
                {q.customer.address ? ` · ${q.customer.address}` : ""}
              </p>

              {/* Items summary */}
              {q.items.length > 0 && (
                <p className="text-xs text-gray-400 line-clamp-2">
                  {q.items.map((it) => `${it.description} (${it.quantity})`).join(" · ")}
                </p>
              )}

              {/* Work notes */}
              {q.workNotes && (
                <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-2">{q.workNotes}</p>
              )}

              {/* Photographed date (done tab) */}
              {q.photographedAt && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> {t("photographedOn")}: {fmtDate(q.photographedAt)}
                </p>
              )}

              {/* Photographer assignment */}
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <select
                  value={q.photographer || ""}
                  onChange={(e) => patch(q.id, { photographer: e.target.value }, { photographer: e.target.value || null })}
                  className="field h-9 text-xs flex-1"
                >
                  <option value="">{t("noPhotographer")}</option>
                  {photographers.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Photo notes */}
              {noteId === q.id ? (
                <div className="flex items-center gap-2">
                  <input value={noteValue} onChange={(e) => setNoteValue(e.target.value)}
                    placeholder={t("photoNotesPlaceholder")} className="field h-9 text-xs flex-1" autoFocus />
                  <button onClick={saveNote} className="px-3 h-9 rounded-lg bg-gray-900 text-white text-xs font-bold">{t("saveBtn")}</button>
                </div>
              ) : q.photoNotes ? (
                <button onClick={() => { setNoteId(q.id); setNoteValue(q.photoNotes || ""); }}
                  className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-start">
                  {q.photoNotes}
                </button>
              ) : (
                <button onClick={() => { setNoteId(q.id); setNoteValue(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600 text-start">+ {t("photoNotesLabel")}</button>
              )}

              {/* Contact + location row */}
              <div className="flex items-center gap-2">
                <a href={telLink(q)} className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Phone className="w-3.5 h-3.5" /> {t("callAction")}
                </a>
                <a href={waLink(q)} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border border-green-200 dark:border-green-800 text-xs font-bold text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20">
                  <MessageCircle className="w-3.5 h-3.5" /> {t("whatsappAction")}
                </a>
                <a href={q.deliveryLocation ? preciseHref(q.deliveryLocation) : areaHref(q)} target="_blank" rel="noreferrer"
                  className={cn("flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-bold",
                    q.deliveryLocation
                      ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700")}>
                  <MapPin className="w-3.5 h-3.5" /> {q.deliveryLocation ? t("preciseLocation") : t("openMaps")}
                </a>
              </div>

              {/* Primary action */}
              {tab === "queue" ? (
                <button onClick={() => markPhotographed(q)}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors">
                  <Check className="w-4 h-4" /> {t("markPhotographed")}
                </button>
              ) : (
                <button onClick={() => needsReshoot(q)}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm font-bold transition-colors">
                  <RotateCcw className="w-4 h-4" /> {t("needsReshoot")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
