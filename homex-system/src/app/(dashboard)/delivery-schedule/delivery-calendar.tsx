"use client";

import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { displayName } from "@/lib/translit";
import { Phone, MessageCircle, FileText, X, User, Plus, Loader2 } from "lucide-react";

// A single delivery mapped for the calendar view.
export interface CalItem {
  id: string;
  name: string;
  wilayat: string;
  governorate: string;
  quoteNumber: string;
  phone: string;
  phoneCode: string;
  date: string;          // deliveryDate (ISO)
  time: string | null;   // "HH:MM" or null
  driver: string;
  status: "ready" | "late" | "delivered";
}

const DAY_NAMES = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const DAY_NAMES_EN = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STATUS = {
  ready: { bar: "border-s-teal-500", bg: "bg-gray-50 dark:bg-gray-800/60", pill: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300", label: "جاهز" },
  late: { bar: "border-s-red-500", bg: "bg-red-50 dark:bg-red-900/15", pill: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "متأخر" },
  delivered: { bar: "border-s-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/15", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", label: "تم التوصيل" },
} as const;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

// Shared state + callbacks threaded to the (module-scope, stable) sub-components
// so they never get re-created during render — a fresh component identity each
// render would remount the whole grid and stutter the swipe.
interface CalCtx {
  canEdit: boolean;
  locale: string;
  today: Date;
  dragId: string | null;
  overKey: string | null;
  setDragId: Dispatch<SetStateAction<string | null>>;
  setOverKey: Dispatch<SetStateAction<string | null>>;
  setOpenDay: Dispatch<SetStateAction<Date | null>>;
  setAddDay: Dispatch<SetStateAction<Date | null>>;
  onReschedule: (id: string, date: string) => void;
  itemsOn: (day: Date) => CalItem[];
}

function Chip({ it, ctx }: { it: CalItem; ctx: CalCtx }) {
  const s = STATUS[it.status];
  return (
    <div
      draggable={ctx.canEdit}
      onDragStart={() => ctx.setDragId(it.id)}
      onDragEnd={() => { ctx.setDragId(null); ctx.setOverKey(null); }}
      title={`${displayName(it.name, ctx.locale)} — ${it.wilayat}${it.time ? " · " + it.time : ""} · ${it.driver}`}
      className={cn(
        "rounded-md border border-gray-200 dark:border-gray-700 border-s-[3px] px-1.5 py-1 transition-all hover:shadow-sm",
        ctx.canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        s.bar, s.bg, ctx.dragId === it.id && "opacity-40",
      )}
    >
      <div className="text-[11.5px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1 min-w-0">
        {it.status === "delivered" && <span className="text-emerald-600 shrink-0">✔</span>}
        <span className="truncate">{displayName(it.name, ctx.locale)}</span>
      </div>
      <div className="text-[10px] text-gray-500 truncate">{it.wilayat}{it.time ? <span className="font-mono-en"> · {it.time}</span> : null}</div>
    </div>
  );
}

function DayCell({ day, ctx }: { day: Date; ctx: CalCtx }) {
  const dayItems = ctx.itemsOn(day);
  const isToday = sameDay(day, ctx.today);
  const busy = dayItems.length >= 3;
  const key = ymd(day);
  return (
    <div
      onClick={() => { if (dayItems.length) ctx.setOpenDay(day); }}
      onDragOver={(e) => { if (ctx.canEdit && ctx.dragId) { e.preventDefault(); ctx.setOverKey(key); } }}
      onDragLeave={() => ctx.setOverKey((k) => (k === key ? null : k))}
      onDrop={(e) => { e.preventDefault(); if (ctx.canEdit && ctx.dragId) ctx.onReschedule(ctx.dragId, key); ctx.setDragId(null); ctx.setOverKey(null); }}
      className={cn(
        "rounded-xl border p-1.5 flex flex-col gap-1 min-h-[112px]",
        dayItems.length && "cursor-pointer hover:border-gray-400 dark:hover:border-gray-500",
        isToday ? "border-gray-900 dark:border-white bg-gray-50/50 dark:bg-gray-800/40" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800",
        ctx.overKey === key && "ring-2 ring-teal-400 border-teal-400",
      )}
    >
      <div className="flex items-center justify-between px-0.5">
        {ctx.canEdit
          ? <button
              onClick={(e) => { e.stopPropagation(); ctx.setAddDay(day); }}
              title="إضافة طلب جاهز للتوصيل"
              className="w-5 h-5 rounded-md flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#8b9a7b] transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          : (busy
            ? <span className="text-[9px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded-full">{dayItems.length}</span>
            : <span />)}
        <span className={cn("text-[14px] font-black font-mono-en leading-none", isToday ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 w-6 h-6 rounded-md flex items-center justify-center" : "text-gray-700 dark:text-gray-200")}>{day.getDate()}</span>
      </div>
      <div className="flex flex-col gap-1">
        {dayItems.map((it) => <Chip key={it.id} it={it} ctx={ctx} />)}
      </div>
    </div>
  );
}

// One month's grid of day cells (Saturday-first). Rendered inside each panel.
function MonthGrid({ anchor, ctx }: { anchor: Date; ctx: CalCtx }) {
  const y = anchor.getFullYear(), m = anchor.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const days = Array.from({ length: lastDay }, (_, i) => new Date(y, m, i + 1));
  const leading = (new Date(y, m, 1).getDay() + 1) % 7;
  return (
    <div className="grid grid-cols-7 gap-2 content-start">
      {Array.from({ length: leading }, (_, i) => <div key={`b${i}`} />)}
      {days.map((day) => <DayCell key={ymd(day)} day={day} ctx={ctx} />)}
    </div>
  );
}

export function DeliveryCalendar({
  monthAnchor, items, onToday, onPrevMonth, onNextMonth, onReschedule, onAddReady, canEdit,
}: {
  monthAnchor: Date;
  items: CalItem[];
  onToday: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onReschedule: (id: string, date: string) => void;
  // Schedule a ready-for-delivery order (possibly with no date yet) onto a day —
  // needs a calendar refresh so a newly-scheduled order appears.
  onAddReady?: (id: string, date: string) => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const dayNames = locale === "en" ? DAY_NAMES_EN : DAY_NAMES;
  const monthNames = locale === "en" ? MONTHS_EN : MONTHS;
  const statusLabel = (s: CalItem["status"]) => (s === "ready" ? t("dcReady") : s === "late" ? t("dcLate") : t("deliveredStatus"));
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [addDay, setAddDay] = useState<Date | null>(null);
  const [ready, setReady] = useState<any[] | null>(null);
  const [readyLoading, setReadyLoading] = useState(false);
  const [readyQ, setReadyQ] = useState("");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const waHref = (it: CalItem) => `https://wa.me/${`${it.phoneCode}${it.phone}`.replace(/\D/g, "")}`;

  useEffect(() => {
    if (!openDay) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenDay(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDay]);

  // When the + on a day opens, load the ready-for-delivery orders once.
  useEffect(() => {
    if (!addDay) return;
    setReadyQ("");
    setReadyLoading(true);
    fetch("/api/work-orders?workStatus=ready_for_delivery")
      .then((r) => (r.ok ? r.json() : { quotations: [] }))
      .then((d) => setReady(d.quotations || []))
      .catch(() => setReady([]))
      .finally(() => setReadyLoading(false));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAddDay(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addDay]);

  // ── Finger-following carousel ──────────────────────────────────────────────
  // Three month panels (next / current / prev, LTR) sit in a track translated
  // one panel to centre the current month. The drag is applied imperatively to
  // the DOM node — never via React state — so moving the finger triggers no
  // re-render (a per-frame re-render would rebuild the grid and stutter). React
  // re-renders only once, on the committed month change, which remounts the
  // keyed track back to the centred base transform.
  const BASE = "translateX(-33.3333%)";
  const trackRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const gesture = useRef<{ x: number; y: number; axis: "?" | "x" | "y" } | null>(null);
  const pending = useRef<"next" | "prev" | null>(null);

  const setTransform = (px: number, animate: boolean) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 300ms ease-out" : "none";
    el.style.transform = px === 0 ? BASE : `translateX(calc(-33.3333% + ${px}px))`;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (openDay || dragId) return;
    pending.current = null;
    widthRef.current = trackRef.current?.parentElement?.clientWidth ?? 0;
    const t = e.touches[0];
    gesture.current = { x: t.clientX, y: t.clientY, axis: "?" };
    setTransform(0, false);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (g.axis === "?") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (g.axis === "y") return; // vertical → let the page scroll
    setTransform(dx, false);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const g = gesture.current; gesture.current = null;
    if (!g) return;
    if (g.axis !== "x") { setTransform(0, false); return; }
    const dx = e.changedTouches[0].clientX - g.x;
    const w = widthRef.current || 1;
    const threshold = Math.min(w * 0.22, 80);
    if (dx <= -threshold) { pending.current = "prev"; setTransform(-w, true); }
    else if (dx >= threshold) { pending.current = "next"; setTransform(w, true); }
    else { pending.current = null; setTransform(0, true); }
  };
  const onTrackTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== trackRef.current || e.propertyName !== "transform") return;
    const dir = pending.current;
    pending.current = null;
    // Commit the month change: the keyed track remounts and re-centres, and the
    // panel we slid to becomes the new middle panel, so the swap is seamless.
    if (dir === "next") onNextMonth();
    else if (dir === "prev") onPrevMonth();
  };

  const cur = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const prevMonth = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
  const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  const curCount = items.filter((it) => sameMonth(new Date(it.date), cur)).length;
  const monthLabel = `${monthNames[cur.getMonth()]} ${cur.getFullYear()}`;

  const itemsOn = (day: Date) =>
    items.filter((it) => sameDay(new Date(it.date), day)).sort((a, b) => (a.time || "~").localeCompare(b.time || "~"));

  const ctx: CalCtx = { canEdit, locale, today, dragId, overKey, setDragId, setOverKey, setOpenDay, setAddDay, onReschedule, itemsOn };

  const scheduleReady = (id: string) => {
    if (!addDay) return;
    (onAddReady || onReschedule)(id, ymd(addDay));
    setReady((prev) => (prev ? prev.filter((q) => q.id !== id) : prev));
  };
  const readyFiltered = (ready || []).filter((q) => {
    const s = readyQ.trim();
    if (!s) return true;
    return (q.customer?.name || "").includes(s) || (q.quoteNumber || "").includes(s) || (q.customer?.wilayat || "").includes(s);
  });

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="min-w-[130px]">
          <div className="text-[15px] font-black text-gray-900 dark:text-white">{monthLabel}</div>
          <div className="text-xs text-gray-400 font-semibold"><span className="font-mono-en">{curCount}</span> {t("dcThisMonth")}</div>
        </div>
        <button onClick={onToday} className="px-4 h-9 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">{t("dcToday")}</button>
        <div className="flex items-center gap-3 flex-wrap ms-auto text-xs font-semibold text-gray-500">
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" /> {t("dcReady")}</span>
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> {t("deliveredStatus")}</span>
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> {t("dcLate")}</span>
        </div>
      </div>

      {/* Weekday header (fixed — shared by every month). */}
      <div className="grid grid-cols-7 gap-2 mb-1.5">
        {dayNames.map((n) => <div key={n} className="text-center text-[11px] font-bold text-gray-400">{n}</div>)}
      </div>

      {/* Carousel: swipe the track left/right; it follows the finger and snaps.
          Forced LTR so the transform math is direction-independent; each panel's
          content is restored to RTL. */}
      <div dir="ltr" className="overflow-hidden" style={{ touchAction: "pan-y" }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div
          ref={trackRef}
          key={`${cur.getFullYear()}-${cur.getMonth()}`}
          onTransitionEnd={onTrackTransitionEnd}
          className="flex items-start"
          style={{ width: "300%", transform: BASE, willChange: "transform" }}
        >
          <div dir="rtl" className="shrink-0" style={{ width: "33.3333%" }}><MonthGrid anchor={nextMonth} ctx={ctx} /></div>
          <div dir="rtl" className="shrink-0" style={{ width: "33.3333%" }}><MonthGrid anchor={cur} ctx={ctx} /></div>
          <div dir="rtl" className="shrink-0" style={{ width: "33.3333%" }}><MonthGrid anchor={prevMonth} ctx={ctx} /></div>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-center mt-3">{t("dcHintTap")}{canEdit ? t("dcHintReschedule") : ""}</p>

      {/* Add ready-for-delivery order to a day */}
      {addDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setAddDay(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[82vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <div className="text-base font-black text-gray-900 dark:text-white">{t("dcReadyOrders")}</div>
                <div className="text-xs text-gray-400 font-semibold">{dayNames[(addDay.getDay() + 1) % 7]} · <span className="font-mono-en">{addDay.getDate()} {monthNames[addDay.getMonth()]}</span></div>
              </div>
              <button onClick={() => setAddDay(null)} className="w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3">
                <input value={readyQ} onChange={(e) => setReadyQ(e.target.value)} placeholder={t("dcSearchOrder")} className="flex-1 bg-transparent py-2.5 text-sm outline-none" />
                {readyLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
              </div>
            </div>
            <div className="p-3 overflow-y-auto flex flex-col gap-2">
              {readyLoading && !ready ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
              ) : readyFiltered.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">{t("dcNoReady")}</div>
              ) : readyFiltered.map((q) => (
                <div key={q.id} className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 p-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 dark:text-white truncate">{displayName(q.customer?.name || "—", locale)} <span className="font-mono-en text-xs text-gray-400">{q.quoteNumber}</span></div>
                    <div className="text-[11px] text-gray-400">{q.customer?.governorate} — {q.customer?.wilayat}{q.deliveryDate ? <span className="font-mono-en"> · {new Date(q.deliveryDate).toLocaleDateString("en-GB")}</span> : <span className="text-amber-600"> · {t("dcNoDate")}</span>}</div>
                  </div>
                  <button onClick={() => scheduleReady(q.id)} className="shrink-0 flex items-center gap-1 text-xs font-bold text-white bg-[#8b9a7b] hover:bg-[#6f7e62] px-3 py-1.5 rounded-lg"><Plus className="w-3.5 h-3.5" />{t("dcAddToDay")}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Day detail modal */}
      {openDay && (() => {
        const list = itemsOn(openDay);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpenDay(null)}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[82vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <div className="text-base font-black text-gray-900 dark:text-white">{dayNames[(openDay.getDay() + 1) % 7]} · <span className="font-mono-en">{openDay.getDate()} {monthNames[openDay.getMonth()]}</span></div>
                  <div className="text-xs text-gray-400 font-semibold"><span className="font-mono-en">{list.length}</span> {t("dcDeliveries")}</div>
                </div>
                <button onClick={() => setOpenDay(null)} className="w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t("dcClose")}><X className="w-4 h-4" /></button>
              </div>
              <div className="p-3 overflow-y-auto flex flex-col gap-2.5">
                {list.map((it) => {
                  const s = STATUS[it.status];
                  const tel = `${it.phoneCode}${it.phone}`;
                  return (
                    <div key={it.id} className={cn("rounded-xl border border-gray-200 dark:border-gray-700 border-s-[3px] p-3", s.bar, s.bg)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                            {it.status === "delivered" && <span className="text-emerald-600">✔</span>}{displayName(it.name, locale)}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{it.governorate} — {it.wilayat} · <span className="font-mono-en">{it.quoteNumber}</span></div>
                          <div className="text-xs text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                            {it.time && <span className="font-mono-en">{it.time}</span>}
                            <span className="flex items-center gap-1"><User className="w-3 h-3" />{it.driver}</span>
                          </div>
                        </div>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", s.pill)}>{statusLabel(it.status)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <a href={`tel:${tel}`} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-xs font-bold hover:opacity-90"><Phone className="w-3.5 h-3.5" /> {t("dcCall")}</a>
                        <a href={waHref(it)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700"><MessageCircle className="w-3.5 h-3.5" /> {t("whatsapp")}</a>
                        <button onClick={() => router.push(`/quotations/${it.id}`)} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800 ms-auto"><FileText className="w-3.5 h-3.5" /> {t("dcOpenOrder")}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
